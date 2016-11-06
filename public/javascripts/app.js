$(function () {
  var $spinner = $('.js-spinner')
  var $textInput = $('.js-raw-data-input')

  $('.js-raw-data-form').on('submit', function (e) {
    e.preventDefault()

    $.ajax({
      url: '/raw/parse',
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



  var App = {}
  App.MainView = Marionette.View.extend({
    template: false,

    el: '.js-uploader-form',

    ui: {
      imageTpl: '#image-tpl',
      group:    '.js-form-group',
      title:    '.js-title',
      status:   '.js-status',
      image:    '.js-image',
      spinner:  '.js-spinner',
      categories:  '.js-categories',
      tags:        '.js-tags'
    },

    events: {
      'submit': 'onFormSubmit',
      'click .js-submit': 'onSubmitClick'
    },

    onRender: function () {
      this.addImageInput()
      this.initTagsinput()
    },

    initTagsinput: function () {
      var self = this

      $.get('/uploader/taxonomy')
        .then(function (data) {
          var categories = data.categories.map((el) => {
            return {
              label: el.name,
              value: el.term_taxonomy_id
            }
          })
          var tags = data.tags.map((el) => {
            return {
              label: el.name,
              value: el.term_taxonomy_id
            }
          })
          self.ui.categories.tokenfield({
            autocomplete: {
              source: categories,
              delay: 100
            },
            showAutocompleteOnFocus: true
          })
          self.ui.tags.tokenfield({
            autocomplete: {
              source: tags,
              delay: 100
            },
            showAutocompleteOnFocus: true
          })
        })
    },

    onFormSubmit: function (e) {
      e.preventDefault()
    },

    onSubmitClick: function (e) {
      var self = this

      e.preventDefault()
      var arr = []
      this.ui.group.find('.js-image').each(function (i, el) {
        if (el.value !== '') arr.push(el.value)
      })
      var title      = this.ui.title.val()
      var status     = this.ui.status.val()
      var categories = this.ui.categories.val()
      var tags =       this.ui.tags.val()

      if (arr.length === 0) {
        alert('empty image list')
        return
      }

      if (title == '') {
        alert('empty title')
        return
      }

      $.ajax({
        url: '/uploader/send',
        method: 'post',
        data: {
          title: title,
          status: status,
          categories: categories,
          tags: tags,
          images: JSON.stringify(arr)
        },
        beforeSend: function () {
          self.ui.spinner.addClass('active')
        },
        success: function() {
          self.ui.spinner.removeClass('active')
        },
        error: function () {
          self.ui.spinner.removeClass('active')
          alert('Something went wrong on server')
        }
      })
    },

    addImageInput: function () {
      var self = this
      var $image = $(this.ui.imageTpl.html())
      $image.one('click', function () {
        self.addImageInput()
      })
      this.ui.group.append($image)
    }
  })

  App.mainView = new App.MainView()
  App.mainView.render()
})
