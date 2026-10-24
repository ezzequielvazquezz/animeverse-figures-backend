class ErrorHttp extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
}
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
module.exports = { ErrorHttp, asyncH };
