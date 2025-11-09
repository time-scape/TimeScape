export async function json<T>(url: string, onProgress?: (progress: number) => void): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    let contentLength = response.headers.get('Content-Length');
    if (!contentLength) {
        console.warn('Unable to retrieve Content-Length. Set default to 30,895,666');
    }
    contentLength = '30895666';
    const total = parseInt(contentLength as any, 10);
    let loaded = 0;

    const reader = response.body!.getReader();

    const stream = new ReadableStream({
        async pull(controller) {
            const { done, value } = await reader.read();
            if (done) {
                controller.close();
                return;
            }
            loaded += value!.byteLength;
            onProgress?.(loaded / total * 100);
            controller.enqueue(value);
        }
    });

    const newResponse = new Response(stream, { headers: response.headers });
    return await newResponse.json() as T;
}