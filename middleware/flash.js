exports.setFlash = (req, type, message) => {
  req.session.flashType = type;
  req.session.flashMessage = message;
};

exports.getFlash = (req) => {
  const message = req.session.flashMessage;
  const type = req.session.flashType;
  delete req.session.flashMessage;
  delete req.session.flashType;
  return message ? { type, message } : null;
};
