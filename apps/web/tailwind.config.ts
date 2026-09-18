import type { Config } from "tailwindcss";

const config: Config = {
    content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: "hsl(var(--card))",
                muted: "hsl(var(--muted))",
                "muted-foreground": "hsl(var(--muted-foreground))",
                border: "hsl(var(--border))",
                primary: "hsl(var(--primary))",
                success: "hsl(var(--success))",
                danger: "hsl(var(--danger))",
                warning: "hsl(var(--warning))",
            },
        },
    },
    plugins: [],
};

export default config;