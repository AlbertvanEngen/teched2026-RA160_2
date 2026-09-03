import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [react()],
	server: {
		proxy: {
			'/api': {
				target: 'http://localhost:3142',
				changeOrigin: true,
			},
			'/sap': {
				target: 'http://localhost:3142',
				changeOrigin: true,
			},
		},
	},
});
