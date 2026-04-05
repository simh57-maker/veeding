/**
 * Detects the largest contiguous transparent (alpha < threshold) bounding box
 * in a PNG image. Returns normalized pixel coordinates.
 */
export interface AlphaBounds {
  x: number
  y: number
  width: number
  height: number
}

export async function detectAlphaBounds(
  dataUrl: string,
  alphaThreshold = 10
): Promise<AlphaBounds | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height)

      let minX = width
      let minY = height
      let maxX = 0
      let maxY = 0
      let found = false

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const alpha = data[(y * width + x) * 4 + 3]
          if (alpha < alphaThreshold) {
            if (x < minX) minX = x
            if (y < minY) minY = y
            if (x > maxX) maxX = x
            if (y > maxY) maxY = y
            found = true
          }
        }
      }

      if (!found) {
        resolve(null)
        return
      }

      resolve({
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      })
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}
