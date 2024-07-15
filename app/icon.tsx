//https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons
import { ImageResponse } from "next/og";

// Image metadata
export const size = {
    width: 32,
    height: 32,
};
export const contentType = "image/svg";

// Image generation
export default function Icon() {
    return new ImageResponse(
        (
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#71717a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-rotate-3d"><path d="M16.466 7.5C15.643 4.237 13.952 2 12 2 9.239 2 7 6.477 7 12s2.239 10 5 10c.342 0 .677-.069 1-.2"/><path d="m15.194 13.707 3.814 1.86-1.86 3.814"/><path d="M19 15.57c-1.804.885-4.274 1.43-7 1.43-5.523 0-10-2.239-10-5s4.477-5 10-5c4.838 0 8.873 1.718 9.8 4"/></svg>
        ),
        // ImageResponse options
        {
            // For convenience, we can re-use the exported icons size metadata
            // config to also set the ImageResponse's width and height.
            ...size,
        }
    );
}