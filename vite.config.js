// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './', // This ensures assets are loaded with relative paths
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Split vendor code (like Phaser) into separate chunks
        manualChunks: {
          phaser: ['phaser'],
          vendor: ['phaser/src/phaser.js']
        }
      }
    }
  },
  // Add this publicDir option to copy static assets
  publicDir: 'public',
  // Add a custom plugin to copy additional files that Vite might miss
  plugins: [
    {
      name: 'copy-assets',
      apply: 'build',
      enforce: 'post',
      generateBundle() {
        // This hook runs after the bundle is generated
        const fs = require('fs');
        const path = require('path');
        
        // List of asset files to ensure they're copied
        const assetFiles = [
          'countryside.png',
          'enemy-sprite.png',
          'enemy-sprite2.png',
          'enemy-sprite3.png',
          'english_game_questions.txt',
          'platform.png',
          'player-sprite.png'
        ];
        
        // Create a public directory if it doesn't exist
        if (!fs.existsSync('public')) {
          fs.mkdirSync('public');
        }
        
        // Copy each asset file to the public directory
        assetFiles.forEach(file => {
          if (fs.existsSync(file)) {
            fs.copyFileSync(file, path.join('public', file));
          }
        });
      }
    }
  ]
});