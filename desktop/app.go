package main

import (
	"context"
	"fmt"
	"os/exec" // For spawning subprocesses
	"strings" // For joining command arguments
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts.
// The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// Greet returns a greeting for the given name (keeping existing method)
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// RunPortapack executes the portapack CLI command with given arguments
func (a *App) RunPortapack(args []string) (string, error) {
	// Prepend "portapack" to the arguments slice
	cmdArgs := append([]string{}, args...) // Create a new slice to avoid modifying the original 'args'

	// Construct the command
	cmd := exec.Command("portapack", cmdArgs...) // "portapack" is the command itself

	// Capture stdout and stderr
	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	fmt.Printf("Executing command: portapack %s\n", strings.Join(cmdArgs, " "))

	// Run the command
	err := cmd.Run()

	// Combine output for display
	output := stdout.String()
	if stderr.Len() > 0 {
		output += "\nError:\n" + stderr.String()
	}

	if err != nil {
		return output, fmt.Errorf("portapack command failed: %w - %s", err, output)
	}

	return output, nil
}
