import React, { useEffect, useRef, useState } from 'react';

// --- Scenario 2: Frontend Performance ---
// Problem: We need to render 5000 simulation entities moving in real-time.
// Using 5000 <div> elements causes React reconciliation to kill framerate.
// Solution: Bypass React's render cycle for the entities by using an HTML5 Canvas.

interface Entity {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
}

const HighFreqMap: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [entityCount, setEntityCount] = useState(5000);
    const fpsRef = useRef(0);

    // Create entities in memory (not in state, to avoid re-renders)
    const entitiesRef = useRef<Entity[]>([]);

    // Initialize entities
    useEffect(() => {
        const ents: Entity[] = [];
        for (let i = 0; i < entityCount; i++) {
            ents.push({
                id: i,
                x: Math.random() * 800,
                y: Math.random() * 600,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                color: i % 2 === 0 ? '#4CAF50' : '#2196F3' // Green for active, Blue for idle
            });
        }
        entitiesRef.current = ents;
    }, [entityCount]);

    // Animation Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: false }); // alpha: false for speed optimization
        if (!ctx) return;

        let animationFrameId: number;
        let lastTime = performance.now();
        let frames = 0;

        const render = (time: number) => {
            frames++;
            if (time - lastTime >= 1000) {
                fpsRef.current = frames;
                frames = 0;
                lastTime = time;
                // Force a re-render only for the FPS counter if needed, 
                // but usually better to draw FPS on canvas to avoid ALL React updates.
            }

            // 1. Clear Canvas efficiently
            ctx.fillStyle = '#1e1e1e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 2. Update and Draw 5000 entities
            // Doing this in a loop here is MUCH faster than 5000 React components
            for (const ent of entitiesRef.current) {
                // Physics Update
                ent.x += ent.vx;
                ent.y += ent.vy;

                // Bounce off walls
                if (ent.x < 0 || ent.x > canvas.width) ent.vx *= -1;
                if (ent.y < 0 || ent.y > canvas.height) ent.vy *= -1;

                // Draw
                // Optimization: Don't use round rects or complex paths if speed is key
                ctx.fillStyle = ent.color;
                ctx.fillRect(ent.x, ent.y, 2, 2);
            }

            // Draw FPS directly on canvas
            ctx.fillStyle = 'white';
            ctx.font = '16px Arial';
            ctx.fillText(`Entities: ${entityCount} | FPS: ${fpsRef.current}`, 10, 20);

            animationFrameId = requestAnimationFrame(render);
        };

        render(performance.now());

        return () => cancelAnimationFrame(animationFrameId);
    }, [entityCount]);

    return (
        <div style={{ border: '1px solid #333', padding: 20 }}>
            <h3>High-Frequency Simulation Renderer</h3>
            <p>
                Demonstrates "Escape Hatch" architecture: React handles the UI shell,
                but raw Canvas API handles the high-volume data visualization.
            </p>
            <div>
                <label>Entity Count: </label>
                <select
                    value={entityCount}
                    onChange={(e) => setEntityCount(Number(e.target.value))}
                    style={{ marginBottom: 10, padding: 5 }}
                >
                    <option value="1000">1,000</option>
                    <option value="5000">5,000</option>
                    <option value="10000">10,000</option>
                </select>
            </div>

            <canvas
                ref={canvasRef}
                width={800}
                height={600}
                style={{ width: '100%', maxWidth: '800px', background: '#000' }}
            />
        </div>
    );
};

export default HighFreqMap;
