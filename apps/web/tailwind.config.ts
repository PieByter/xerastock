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
                elevated: "hsl(var(--elevated))",
                muted: "hsl(var(--muted))",
                "muted-foreground": "hsl(var(--muted-foreground))",
                border: "hsl(var(--border))",
                primary: "hsl(var(--primary))",
                "accent-cyan": "#22D3EE",
                success: "hsl(var(--success))",
                danger: "hsl(var(--danger))",
                warning: "hsl(var(--warning))",
                bsjp: "#22D3EE",
                bpjs: "#F59E0B",
                swing: "#2F81F7",
            },
        },
    },
    plugins: [],
};

export default config;