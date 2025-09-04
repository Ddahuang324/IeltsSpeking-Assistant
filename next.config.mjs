/** @type {import('next').NextConfig} */
const nextConfig = {
	async redirects() {
		return [
			{
				source: '/',
				destination: '/live',
				permanent: true,
			},
		];
	},
	webpack: (config, { isServer }) => {
		// 配置 vosk-browser 库
		if (!isServer) {
			config.resolve.fallback = {
				...config.resolve.fallback,
				fs: false,
				path: false,
				os: false,
			};
			
			// 处理 vosk-browser 的特殊需求
			config.module.rules.push({
				test: /\.wasm$/,
				type: 'asset/resource',
			});
		}
		return config;
	},
};

export default nextConfig;
