package main

import (
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

//go:embed assets/*
var appAssets embed.FS

var settingsMu sync.Mutex
var lastActivity atomic.Int64

func settingsPath() string {
	base, err := os.UserConfigDir()
	if err != nil {
		base = os.TempDir()
	}
	return filepath.Join(base, "JollyJacksParlamentumToolkit", "settings.json")
}

func markActive() { lastActivity.Store(time.Now().Unix()) }

func openBrowser(url string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		return exec.Command("open", url).Start()
	default:
		return exec.Command("xdg-open", url).Start()
	}
}

func main() {
	log.SetFlags(log.LstdFlags)
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		log.Fatal(err)
	}
	markActive()
	server := &http.Server{ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second}
	mux := http.NewServeMux()
	site, err := fs.Sub(appAssets, "assets")
	if err != nil {
		log.Fatal(err)
	}
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		markActive()
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		http.FileServer(http.FS(site)).ServeHTTP(w, r)
	}))
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", 405)
			return
		}
		markActive()
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"ok":true,"offline":true}`)
	})
	mux.HandleFunc("/api/settings", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		markActive()
		settingsMu.Lock()
		defer settingsMu.Unlock()
		path := settingsPath()
		if r.Method == http.MethodGet {
			bytes, err := os.ReadFile(path)
			if errors.Is(err, os.ErrNotExist) {
				io.WriteString(w, `{}`)
				return
			}
			if err != nil {
				http.Error(w, fmt.Sprintf("Read failed: %v", err), 500)
				return
			}
			if !json.Valid(bytes) {
				http.Error(w, "Settings file is not valid JSON", 500)
				return
			}
			w.Write(bytes)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", 405)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 30*1024*1024)
		bytes, err := io.ReadAll(r.Body)
		if err != nil || !json.Valid(bytes) {
			http.Error(w, "Invalid or oversized JSON", 400)
			return
		}
		if err = os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			http.Error(w, "Could not create settings directory", 500)
			return
		}
		tmp, err := os.CreateTemp(filepath.Dir(path), "settings-*.tmp")
		if err != nil {
			http.Error(w, "Could not create settings file", 500)
			return
		}
		tmpPath := tmp.Name()
		defer os.Remove(tmpPath)
		if _, err = tmp.Write(bytes); err == nil {
			err = tmp.Close()
		} else {
			tmp.Close()
		}
		if err == nil {
			err = os.Rename(tmpPath, path)
		}
		if err != nil {
			http.Error(w, "Could not save settings", 500)
			return
		}
		io.WriteString(w, `{"saved":true}`)
	})
	mux.HandleFunc("/api/quit", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", 405)
			return
		}
		io.WriteString(w, `{"closed":true}`)
		go func() { time.Sleep(200 * time.Millisecond); server.Close() }()
	})
	server.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Avoid malicious websites issuing requests to the local server through DNS rebinding.
		if r.Host != listener.Addr().String() {
			http.Error(w, "Forbidden host", 403)
			return
		}
		if r.Method == http.MethodPost && r.Header.Get("Origin") != "http://"+listener.Addr().String() {
			http.Error(w, "Forbidden origin", 403)
			return
		}
		mux.ServeHTTP(w, r)
	})
	url := "http://" + listener.Addr().String() + "/"
	go func() {
		time.Sleep(350 * time.Millisecond)
		if err := openBrowser(url); err != nil {
			log.Printf("Open browser: %s (%v)", url, err)
		}
	}()
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			if time.Now().Unix()-lastActivity.Load() > 15*60 {
				server.Close()
				return
			}
		}
	}()
	log.Printf("JollyJack's Toolkit started at %s", url)
	if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
