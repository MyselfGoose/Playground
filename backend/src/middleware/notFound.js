/**
 * JSON 404 for unknown routes (after all routers).
 */
export function notFound(req, res) {
  res.status(404).json({
    error: {
      message: 'Not Found',
      requestId: req.id,
    },
  });
}
