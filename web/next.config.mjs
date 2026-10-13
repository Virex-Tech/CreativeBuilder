/** @type {import('next').NextConfig} */
const nextConfig = {
	// The player renders the SAME components the render service uses. Importing them from
	// render (rather than copying) is what guarantees the browser preview and the
	// final MP4 cannot drift apart.
	transpilePackages: ["remotion", "@remotion/player"],
	webpack: (config) => {
		config.resolve.alias = {
			...config.resolve.alias,
			"@render": new URL("../render/src", import.meta.url).pathname.replace(
				/^\/([A-Za-z]:)/,
				"$1",
			),
		};

		return config;
	},
};

export default nextConfig;
