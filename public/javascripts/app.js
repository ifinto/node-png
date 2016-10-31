$(function () {
  var $spinner = $('.js-spinner')
  var $textInput = $('.js-raw-data-input')

  $('.js-raw-data-form').on('submit', function (e) {
  	e.preventDefault()

    $.ajax({
      url: '/uploader/parse',
      method: 'post',
      data: {
        rawData: $textInput.val()
      },
      beforeSend: function () {
        $spinner.addClass('active')
      }
    }).done(function () {
      $spinner.removeClass('active')
      $textInput.html('')
    }).fail(function () {
      $spinner.removeClass('active')
      alert('Something went wrong on server')
    })
  })
})