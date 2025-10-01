module.exports = {
  setUserId: function(requestParams, context, ee, next) {
    context.vars.userId = `user-${Math.floor(Math.random() * 1000)}`
    return next()
  },

  setRateData: function(requestParams, context, ee, next) {
    context.vars.raterId = `rater-${Math.floor(Math.random() * 1000)}`
    context.vars.photoId = `photo-${Math.floor(Math.random() * 100)}`
    context.vars.rateType = Math.random() > 0.5 ? 'like' : 'normal'
    return next()
  }
}
