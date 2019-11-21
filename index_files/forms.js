"use strict";
var Carbon;
(function (Carbon) {
    let authenticityTokenMetaEl = document.querySelector('meta[name="authenticityToken"]');
    Carbon.authenticityToken = null;
    if (authenticityTokenMetaEl) {
        Carbon.authenticityToken = authenticityTokenMetaEl.content;
    }
    Carbon.formatters = new Map();
    Carbon.formatters.set('standard', function (value) {
        if (this.form.fields.length === 0) {
            return Promise.resolve('');
        }
        let field = this.form.fields[0];
        return Promise.resolve(field.type === 'password' ? '••••••' : field.value);
    });
    class FieldBlock {
        constructor(element) {
            this.element = element;
            if (!this.element)
                throw new Error("[FieldBlock] element is required");
            if (this.element.dataset['setup'])
                throw new Error('[FieldBlock] already setup');
            this.form = new Form(this.element.querySelector('form'));
            this.form.selectFirstError = false;
            this.form.managed = true;
            this.form.on('submit', this.onSubmit.bind(this));
            this.field = this.form.fields[0];
            this.autosave = this.element.hasAttribute('autosave');
            this.element.addEventListener('field:focus', this.onFocus.bind(this), false);
            this.element.addEventListener('field:blur', this.onBlur.bind(this), false);
            this.element.addEventListener('field:change', () => {
                this.element.classList.add('changed');
                if (this.element.dataset['saveFrequency']) {
                    if (this.saveTimeout) {
                        clearInterval(this.saveTimeout);
                    }
                    this.saveTimeout = setTimeout(() => {
                        _.trigger(this.element, 'saving');
                        this.form.validate().then(() => {
                            this.form.send().then(this.onSent.bind(this));
                        });
                    }, parseInt(this.element.dataset['saveFrequency']));
                }
            }, false);
            this.element.dataset['setup'] = 'true';
            FieldBlock.instances.set(this.element, this);
        }
        static get(element) {
            return FieldBlock.instances.get(element) || new FieldBlock(element);
        }
        onSent() {
            _.trigger(this.element, 'saved');
        }
        onFocus() {
            this.element.classList.add('editing');
        }
        onBlur() {
            if (this.changed && this.autosave) {
                this.save();
            }
            this.element.classList.remove('editing');
        }
        get changed() {
            return this.element.matches('.changed');
        }
        onSubmit() {
            return this.save();
        }
        save() {
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
            }
            if (this.form.status === 1)
                return;
            this.element.classList.remove('changed');
            this.element.classList.add('saving');
            let empty = this.field.type != 'tags'
                ? _.empty(this.field.value)
                : this.field.value.length === 0;
            _.toggleClass(this.element, 'empty', empty);
            this.form.validate().then(() => {
                this.form.send().then(this.onSaved.bind(this), this.onFail.bind(this));
            });
            return false;
        }
        onFail() {
            _.removeClass(this.element, 'valid', 'invalid', 'saving');
        }
        onSaved() {
            _.removeClass(this.element, 'invalid', 'saving', 'changed', 'new');
            _.addClass(this.element, 'valid', 'saved', 'sent');
            let onSent = this.element.getAttribute('on-sent');
            onSent && Carbon.ActionKit.execute({
                target: this.element
            }, onSent);
        }
    }
    FieldBlock.instances = new WeakMap();
    Carbon.FieldBlock = FieldBlock;
    class EditBlock {
        constructor(el) {
            this.editing = false;
            this.element = typeof el === 'string' ? document.querySelector(el) : el;
            if (!this.element) {
                throw new Error('[EditBlock] element missing');
            }
            if (this.element.matches('.setup')) {
                throw new Error('[EditBlock] already setup');
            }
            let cancelEl = this.element.querySelector('.cancel');
            cancelEl && cancelEl.addEventListener('click', this.cancel.bind(this));
            let formEl = this.element.querySelector('form');
            this.form = new Form(formEl);
            this.form.managed = true;
            formEl.addEventListener('submit', this.onSubmit.bind(this));
            this.formatter = Carbon.formatters.get(this.element.dataset['formatter'] || 'standard');
            this.element.classList.add('setup');
            this.element.addEventListener('click', this.edit.bind(this));
            EditBlock.instances.set(this.element, this);
        }
        static get(element) {
            return EditBlock.instances.get(element) || new EditBlock(element);
        }
        get textEl() {
            return this.element.querySelector('.text');
        }
        on(name, callback) {
            this.element.addEventListener(name, callback, false);
        }
        edit(e) {
            if (this.element.matches('.editing, .disabled'))
                return;
            this.element.addEventListener('field:change', this.onChange.bind(this));
            if (e && e.target && e.target.matches('.action, .destroy, .handle')) {
                return;
            }
            this.editing = true;
            for (var el of Array.from(document.querySelectorAll('.editBlock.editing'))) {
                EditBlock.get(el).close();
            }
            this.element.classList.add('editing');
            let fieldSelected = false;
            this.takeSnapshot();
            for (var field of this.form.fields) {
                _.trigger(field.input.element, 'poke');
                if (!fieldSelected && field.autoselect) {
                    field.select();
                    fieldSelected = true;
                }
            }
            let detail = {
                instance: this
            };
            _.trigger(this.element, 'edit', detail);
            _.trigger(this.element, 'block:edit', detail);
        }
        cancel(e) {
            this.revertToSnapshot();
            this.close(e, true);
        }
        close(e, canceled) {
            this.editing = false;
            this.element.classList.remove('editing');
            e && e.preventDefault();
            e && e.stopPropagation();
            canceled && this.element.classList.remove('changed');
            let detail = {
                canceled: canceled,
                instance: this,
                changed: this.element.matches('.changed')
            };
            this.element.classList.remove('changed');
            _.trigger(this.element, 'close', detail);
            _.trigger(this.element, 'block:close', detail);
        }
        setValue(value) {
            let field = this.form.fields[0];
            field.value = value;
            this.setPreviewHtml(value);
        }
        setPreviewHtml(value) {
            if (_.empty(value)) {
                this.element.classList.remove('populated');
                this.element.classList.add('empty');
            }
            else {
                this.element.classList.remove('empty');
                this.element.classList.add('populated');
            }
            if (this.textEl) {
                this.textEl.innerHTML = value;
            }
        }
        onSubmit() {
            return this.save();
        }
        onChange(e) {
            this.element.classList.add('changed');
            _.toggleClass(this.element, 'empty', !e.detail.value);
        }
        save() {
            if (this.form.status === 1)
                return;
            if (!this.element.matches('.changed, .adding')) {
                this.close();
                return;
            }
            if (this.onSave) {
                let result = this.onSave();
                if (result === false)
                    return false;
                if (result === true)
                    return true;
            }
            if (this.form.element.hasAttribute('passthrough'))
                return;
            this.form.validate().then(() => {
                this.element.classList.remove('changed');
                this.element.classList.add('saving');
                _.trigger(this.element, 'block:save', { instance: this });
                this.form.send().then(this.onSaved.bind(this), this.onFail.bind(this));
            });
        }
        onFail() {
            _.removeClass(this.element, 'valid', 'invalid', 'saving');
        }
        onSaved(data) {
            let response = this.form.response;
            let saveDelay = this.element.dataset['saveDelay'];
            if (saveDelay) {
                setTimeout(() => {
                    this._onSaved(response, data);
                }, parseInt(saveDelay));
            }
            else {
                this._onSaved(response, data);
            }
        }
        _onSaved(response, data) {
            _.removeClass(this.element, 'invalid', 'saving', 'changed', 'new');
            _.addClass(this.element, 'valid', 'saved', 'sent');
            this.takeSnapshot();
            let created = response && response.status === 201;
            created && this.element.classList.remove('adding');
            _.trigger(this.element, 'block:saved', {
                instance: this,
                response: response,
                data: data,
                created: created
            });
            this.formatter.call(this, data).then((html) => {
                this.setPreviewHtml(html);
                this.close();
            });
        }
        remove() {
            _.trigger(this.element, 'block:remove', { instance: this });
            this.dispose();
            this.element.remove();
        }
        takeSnapshot() {
            this.form.takeSnapshot();
        }
        revertToSnapshot() {
            this.form.revertToSnapshot();
        }
        dispose() {
        }
    }
    EditBlock.instances = new WeakMap();
    Carbon.EditBlock = EditBlock;
    class Form {
        constructor(element, options) {
            this.status = 0;
            this.fields = [];
            this.focusInvalidField = true;
            this.validity = 0;
            this.selectFirstError = true;
            this.managed = false;
            this.element = (typeof element === 'string')
                ? document.querySelector(element)
                : element;
            if (!this.element) {
                throw new Error('[Carbon.Form] element not found');
            }
            this.element.setAttribute('novalidate', 'true');
            this.fields = Array
                .from(this.element.querySelectorAll('.field'))
                .filter(el => !el.parentElement.closest('.field'))
                .map(el => new Field(el, this));
            if (this.element.hasAttribute('passthrough'))
                return;
            this.element.addEventListener('submit', this.onSubmit.bind(this), true);
            if (this.element.dataset['validateMode'] === 'immediate') {
                this.fields.forEach(field => {
                    if (!field.validateMode) {
                        field.validateMode = 'immediate';
                    }
                });
                this.element.addEventListener('field:validated', () => {
                    let valid = this.fields.filter(f => !f.valid).length === 0;
                    this.setValidity(valid ? 1 : 2);
                });
            }
            Form.instances.set(this.element, this);
            this.element.classList.add('setup');
            if (options && options.managed) {
                this.managed = true;
            }
            this.reactive = new Carbon.Reactive();
        }
        static get(el) {
            return Form.instances.get(el) || new Form(el);
        }
        get name() {
            return this.element.name;
        }
        get valid() {
            return this.validity = 1;
        }
        on(type, listener) {
            return this.reactive.on(type, listener);
        }
        onSubmit(e) {
            e.preventDefault();
            if (this.managed || this.status === 1)
                return;
            this.canceled = false;
            this.reactive.trigger({ type: 'submit' });
            if (this.canceled) {
                return;
            }
            let validate = this.element.dataset['validate'];
            if (validate === 'remote') {
                this.send();
                return;
            }
            this.validate().then(this.send.bind(this), errors => {
                console.log('errors', errors);
            });
        }
        fillIn(data) {
            for (var key in data) {
                let value = data[key];
                let field = this.getField(key);
                if (field) {
                    field.value = value;
                }
            }
        }
        validate() {
            this.element.classList.add('validating');
            this.reactive.trigger({
                type: 'validate',
                target: this.element
            });
            let unvalidatedFields = this.fields.filter(f => !f.validated);
            return new Promise((resolve, reject) => {
                Promise.all(unvalidatedFields.map(f => f.validate())).then(results => {
                    this.invalidFields = this.fields.filter(f => !f.valid);
                    let valid = this.invalidFields.length === 0;
                    this.setValidity(valid ? 1 : 2);
                    if (!valid && this.focusInvalidField) {
                        this.invalidFields[0].select();
                    }
                    this.reactive.trigger({
                        type: 'validated',
                        validity: this.validity,
                        valid: valid,
                        target: this.element
                    });
                    if (valid) {
                        resolve(true);
                    }
                    else {
                        reject(this.invalidFields);
                    }
                });
            });
        }
        setValidity(validity) {
            this.validity = validity;
            _.removeClass(this.element, 'validated', 'validating', 'valid', 'invalid');
            switch (validity) {
                case 1:
                    _.addClass(this.element, 'validated', 'valid');
                    break;
                case 2:
                    _.addClass(this.element, 'validated', 'invalid');
                    break;
            }
        }
        serialize() {
            let data = {};
            for (let { name, value, type, serializable } of this.fields) {
                if (!serializable)
                    continue;
                if (type === 'checkbox') {
                    value = value === 'true';
                }
                let isArray = name.indexOf('[') > -1;
                if (isArray) {
                    name = name.substring(0, name.indexOf('['));
                }
                else if (name in data) {
                    isArray = true;
                }
                if (isArray) {
                    if (!Array.isArray(data[name])) {
                        data[name] = (name in data) ? [data[name]] : [];
                    }
                    data[name].push(value);
                }
                else {
                    data[name] = value;
                }
            }
            let hiddenInputEls = Array.from(this.element.querySelectorAll('input[type="hidden"]'));
            for (let input of hiddenInputEls) {
                if (input.dataset['skip']) {
                    continue;
                }
                if (input.name) {
                    data[input.name] = input.value;
                }
            }
            this.reactive.trigger({ type: 'serialize', data });
            return data;
        }
        send() {
            this.canceled = false;
            if (this.status === 1) {
                return Promise.reject('Sending');
            }
            this.sent = new Date().getTime();
            this.status = 1;
            this.element.classList.add('sending');
            let formData = this.serialize();
            let authenticityTokenInput = this.element.querySelector("input[name='authenticityToken']");
            if (authenticityTokenInput) {
                Carbon.authenticityToken = authenticityTokenInput.value;
            }
            this.reactive.trigger({
                type: 'send',
                target: this.element,
                data: formData
            });
            if (this.canceled) {
                this.status = 3;
                return;
            }
            let request = new Request(this.element.action, {
                method: this.element.getAttribute('method') || 'POST',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            if (Carbon.authenticityToken) {
                request.headers.append('X-Authenticity-Token', Carbon.authenticityToken);
            }
            if (Carbon.authorization) {
                request.headers.append('Authorization', Carbon.authorization);
            }
            return fetch(request).then(response => {
                this.response = response;
                return response.json();
            }).then(responseData => {
                if (this.response.ok) {
                    this.onSent(responseData);
                    return Promise.resolve(responseData);
                }
                else {
                    this.onFail(responseData);
                    return Promise.reject(responseData);
                }
            });
        }
        onFail(data) {
            this.status = 5;
            this.element.classList.remove('sending');
            let errors = data.errors;
            if (!errors)
                return;
            this.setValidationErrors(errors);
        }
        setValidationErrors(errors) {
            for (var error of errors) {
                if (error.key) {
                    let field = this.getField(error.key);
                    if (field) {
                        field.errors = [];
                        field.addError(error);
                        field.setState(2);
                    }
                }
                else {
                    this.setError(error);
                }
            }
            this.invalidFields = this.fields.filter(f => !f.valid);
            let valid = this.invalidFields.length === 0;
            this.setValidity(valid ? 1 : 2);
            if (!valid && this.selectFirstError) {
                this.invalidFields[0].select();
            }
        }
        setError(error) {
            this.element.classList.add('error');
            let errorEl = this.element.querySelector('.error');
            if (errorEl) {
                let messageEl = errorEl.querySelector('.message');
                if (messageEl) {
                    messageEl.innerHTML = error.message;
                }
                if (error.description) {
                    errorEl.classList.add('hasDescription');
                    let descriptionEl = errorEl.querySelector('.description');
                    descriptionEl.innerHTML = error.description;
                }
            }
            let detail = {
                type: 'error'
            };
            Object.assign(detail, error);
            this.reactive.trigger(detail);
            let onError = this.element.getAttribute('on-error');
            onError && Carbon.ActionKit.execute({
                target: this.element,
                model: error
            }, onError);
        }
        getField(name) {
            let slug = name.toLowerCase();
            let matches = this.fields.filter(f => f.slug === slug);
            return matches.length > 0 ? matches[0] : null;
        }
        onSent(responseData) {
            this.status = 2;
            if (responseData.redirect && responseData.redirect.url) {
                window.location.assign(responseData.redirect.url);
                return;
            }
            _.removeClass(this.element, 'sending', 'error');
            this.element.classList.add('sent');
            let eventData = {
                type: 'sent',
                status: this.response.status,
                created: this.response.status === 201,
                target: this.element,
                response: this.response,
                result: responseData
            };
            this.reactive.trigger(eventData);
            let onSent = this.element.getAttribute('on-sent');
            onSent && Carbon.ActionKit.execute(eventData, onSent);
        }
        invalidate(clear) {
            this.setValidity(0);
            _.removeClass(this.element, 'error', 'sending', 'saved', 'sent');
            for (var field of this.fields) {
                if (clear) {
                    field.value = '';
                }
                field.setValidity(0);
            }
            ;
            this.invalidFields = [];
        }
        takeSnapshot() {
            this.fields.forEach(field => {
                field.savedValue = field.value;
            });
        }
        revertToSnapshot() {
            this.fields.forEach(field => {
                field.value = field.savedValue;
            });
        }
        reset(clear) {
            this.invalidate(clear);
        }
        dispose() {
            this.element.classList.remove('setup');
        }
    }
    Form.instances = new WeakMap();
    Carbon.Form = Form;
    class Field {
        constructor(element, form) {
            this.validators = [];
            this.restrictions = [];
            this.errors = [];
            this.validating = false;
            this.validity = 0;
            this.reactive = new Carbon.Reactive();
            this.element = element;
            this.form = form;
            this.messageEl = this.element.querySelector('.message');
            if (this.element.dataset['type'] === 'tags') {
                this.type = 'tags';
                let list = TokenList.get(this.element);
                this.input = list;
                list.inputEl.addEventListener('focus', this.onFocus.bind(this));
                list.inputEl.addEventListener('blur', this.onBlur.bind(this));
                list.on('change', (e) => {
                    _.trigger(this.element, 'field:change', e.detail);
                });
                return;
            }
            var inputEl;
            if ((inputEl = this.element.querySelector('input'))) {
                this.input = (inputEl.type === 'checkbox')
                    ? new HtmlCheckbox(inputEl)
                    : new HtmlInput(inputEl);
            }
            else if ((inputEl = this.element.querySelector('textarea'))) {
                this.input = new HtmlInput(inputEl);
            }
            else if ((inputEl = this.element.querySelector('select'))) {
                this.input = new HtmlSelect(inputEl);
            }
            else {
                throw new Error('Input element not found');
            }
            this.type = this.input.type;
            this.required = this.input.required;
            this.validateMode = this.element.dataset['validateMode'];
            if (this.autofocus && this.input.active) {
                this.element.classList.add('focused');
            }
            this.input.element.addEventListener('blur', this.onBlur.bind(this));
            this.input.element.addEventListener('focus', this.onFocus.bind(this));
            this.input.element.addEventListener('input', this.onChange.bind(this));
            this.input.element.addEventListener('keypress', this.onKeyPress.bind(this));
            this.input.element.addEventListener('change', this.onChange.bind(this));
            if (this.value) {
                this.element.classList.remove('empty');
            }
            else {
                this.element.classList.add('empty');
            }
            this.validateFrequency = this.input.validateFrequency;
            if (this.input.restrict) {
                switch (this.input.restrict) {
                    case 'number':
                        this.restrictions.push(InputRestriction.Number);
                        break;
                    case 'tag':
                        this.restrictions.push(InputRestriction.Tag);
                        break;
                }
            }
            if (this.input.validateRemote) {
                this.validators.push(new RemoteValidator(this.input.validateRemote));
            }
            if (this.validateFrequency) {
                this.validateCallback = _.debounce(this.validate.bind(this), this.validateFrequency, false);
            }
            switch (this.type) {
                case 'email':
                    this.validators.push(new EmailAddressValidator());
                    break;
                case 'url':
                    this.validators.push(new UrlValidator(this.input.element.hasAttribute('autocorrect')));
                    break;
                case 'creditcardnumber':
                    this.validators.push(new CreditCardNumberValidator());
                    break;
            }
            if (this.minlength > 0) {
                this.validators.push(new StringLengthValidator(this.minlength, this.maxlength));
            }
            if (this.required) {
                this.element.classList.add('required');
            }
            if (this.element.querySelector('.suggestions')) {
                this.autoComplete = new AutoComplete(this.element);
            }
            if (this.type !== 'checkbox' && !_.empty(this.value)) {
                this.validate();
            }
        }
        get name() {
            return this.element.getAttribute('name') || this.element.dataset['name'] || this.input.name;
        }
        get serializable() {
            let serializeAttribute = this.element.getAttribute('serialize') || this.input.element.getAttribute('serialize');
            return serializeAttribute !== "false";
        }
        get slug() {
            return (this.name) ? this.name.toLowerCase() : null;
        }
        get autofocus() {
            return this.input.autofocus || false;
        }
        get autoselect() {
            return this.input.autoselect;
        }
        get minlength() {
            return this.input.minlength || 0;
        }
        get maxlength() {
            return this.input.maxlength || 100000;
        }
        get validated() {
            return this.validity !== 0;
        }
        get valid() {
            return this.validity === 1;
        }
        onKeyPress(e) {
            for (var restriction of this.restrictions) {
                if (restriction(e)) {
                    e.preventDefault();
                    return;
                }
            }
        }
        focus() {
            this.input.focus();
        }
        select() {
            this.input.select();
        }
        set value(value) {
            this.input.value = value;
        }
        get value() {
            return this.input.value;
        }
        getSelection() {
            return this.input.getSelection();
        }
        hasSelection() {
            let selection = this.getSelection();
            return selection[0] !== selection[1];
        }
        onBlur() {
            if (this.validity === 0) {
                this.validate();
            }
            setTimeout(() => {
                this.element.classList.remove('focused');
                _.trigger(this.element, 'field:blur');
            }, 1);
        }
        onFocus() {
            this.element.classList.add('focused');
            _.trigger(this.element, 'field:focus');
        }
        invalidate() {
            this.setValidity(0);
        }
        setValidity(validity) {
            this.validity = validity;
            this.element.classList.remove('validating');
            if (validity === 0) {
                _.removeClass(this.element, 'valid', 'invalid');
                return;
            }
            this.element.classList.remove(this.valid ? 'invalid' : 'valid');
            this.element.classList.add(this.valid ? 'valid' : 'invalid');
            _.trigger(this.element, 'field:validated', {
                field: this,
                valid: this.valid,
                validity: validity
            });
        }
        onChange(e) {
            if (e.keyCode === 9)
                return;
            this.invalidate();
            let empty = !this.value || this.value.length === 0;
            _.toggleClass(this.element, 'empty', empty);
            if (this.type === 'checkbox') {
                _.toggleClass(this.element, 'checked', this.input.checked);
            }
            if (this.type === 'creditcardnumber') {
                this.detectCreditCardType(this.value);
            }
            if (this.validateFrequency) {
                this.validateCallback();
            }
            else if (this.validateMode === 'immediate') {
                this.validate();
            }
            _.trigger(this.element, 'field:change', {
                name: this.name,
                value: this.value
            });
        }
        detectCreditCardType(val) {
            let ccTypeMap = {
                '4': 'visa',
                '5': 'masterCard',
                '3': 'americanExpress',
                '6': 'discover'
            };
            let type = (val && val.length) ? ccTypeMap[val[0]] : null;
            if (!type || !this.element.classList.contains(type)) {
                _.removeClass(this.element, 'visa', 'masterCard', 'americanExpress', 'discover');
                this.element.classList.add(type);
                _.trigger(this.element, 'typeDetected', { type: type });
            }
        }
        validate() {
            this.errors = [];
            if (this.type !== 'checkbox' && _.empty(this.value)) {
                let state = this.required ? 2 : 1;
                if (this.required) {
                    this.addError({ message: 'Required' });
                }
                this.setState(state);
                return Promise.resolve(state);
            }
            this.validating = true;
            if (this.validateFrequency) {
                this.element.classList.add('validating');
            }
            if (this.type === 'tags') {
                this.setState(1);
                return Promise.resolve(1);
            }
            if (this.validators.length === 0) {
                this.setState(1);
                return Promise.resolve(this.validity);
            }
            return Promise.all(this.validators.map(v => v.validate(this))).then(results => {
                let failedValidations = this.validators.filter(v => !v.valid);
                let replaced = false;
                let ok = true;
                for (var validator of failedValidations) {
                    if (validator.replacement) {
                        replaced = true;
                        this.value = validator.replacement;
                        return this.validate();
                    }
                    if (validator.error) {
                        ok = false;
                        this.addError(validator.error);
                    }
                }
                ;
                this.setState(ok ? 1 : 2);
                return replaced ? this.validate() : Promise.resolve(this.validity);
            });
        }
        addError(error) {
            this.errors.push(error);
        }
        setState(state) {
            this.validating = false;
            if (state === 1) {
                this.setValidity(1);
            }
            else if (state === 2) {
                if (this.errors.length > 0 && this.messageEl) {
                    this.messageEl.innerHTML = this.errors[0].message;
                }
                this.setValidity(2);
            }
        }
        remove() {
            this.element.remove();
            this.form && this.form.fields.remove(this);
        }
    }
    Carbon.Field = Field;
    class HtmlSelect {
        constructor(element) {
            this.type = 'select';
            this.element = element;
        }
        get required() {
            return this.element.hasAttribute('required');
        }
        get name() {
            return this.element.name;
        }
        get active() { return false; }
        getSelection() { return [0, 0]; }
        get value() {
            let selectedEl = this.element.options[this.element.selectedIndex];
            return selectedEl.value || selectedEl.text;
        }
    }
    Carbon.HtmlSelect = HtmlSelect;
    class HtmlCheckbox {
        constructor(element) {
            this.type = 'checkbox';
            this.element = element;
        }
        select() {
        }
        get name() {
            return this.element.name;
        }
        get required() {
            return this.element.hasAttribute('required');
        }
        get checked() {
            return this.element.checked;
        }
        get value() {
            return this.checked.toString();
        }
    }
    Carbon.HtmlCheckbox = HtmlCheckbox;
    class HtmlInput {
        constructor(element) {
            this.element = element;
            this.restrict = element.dataset['restrict'];
            this.validateRemote = element.dataset['validateRemote'];
            if (element.dataset['validateFrequency']) {
                this.validateFrequency = parseInt(element.dataset['validateFrequency']);
            }
            if (element.hasAttribute('autoexpand')) {
                this.autoExpander = new AutoExpander(this.element);
            }
            if (element.hasAttribute('minlength')) {
                this.minlength = parseInt(element.getAttribute('minlength'), 10);
            }
            if (element.hasAttribute('maxlength')) {
                this.maxlength = parseInt(element.getAttribute('maxlength'), 10);
            }
        }
        get name() {
            return this.element.name;
        }
        set name(value) {
            this.element.name = value;
        }
        get type() {
            return this.element.getAttribute('type') || 'text';
        }
        get required() {
            return this.element.required;
        }
        get autofocus() {
            return this.element.autofocus;
        }
        get autoselect() {
            return this.element.hasAttribute('autoselect');
        }
        get active() {
            return document.activeElement == this.element;
        }
        getSelection() {
            let start = this.element.selectionStart;
            let end = this.element.selectionEnd;
            if (start === undefined || end === undefined) {
            }
            return [start, end];
        }
        focus() {
            this.element.focus();
        }
        select() {
            this.element.select();
        }
        get value() {
            return this.element.value;
        }
        set value(value) {
            if (this.element.value === value)
                return;
            this.element.value = value;
            _.trigger(this.element, 'change');
        }
    }
    Carbon.HtmlInput = HtmlInput;
    class RequiredValidator {
        validate(field) {
            this.valid = field.value.trim().length > 0;
            if (!this.valid) {
                this.error = { message: 'Required' };
            }
            return Promise.resolve(this.valid);
        }
    }
    class StringLengthValidator {
        constructor(minLength, maxLength) {
            this.minLength = minLength;
            this.maxLength = maxLength;
        }
        validate(field) {
            let value = field.value;
            this.valid = value.length >= this.minLength && value.length <= this.maxLength;
            if (!this.valid) {
                if (value.length < this.minLength) {
                    this.error = { message: `Must be at least ${this.minLength} characters` };
                }
                else {
                    this.error = { message: `Must be fewer than ${this.maxLength} characters` };
                }
            }
            return Promise.resolve(this.valid);
        }
    }
    class UrlValidator {
        constructor(autoCorrect) {
            this.autoCorrect = autoCorrect;
        }
        validate(field) {
            let value = field.value;
            let autoCorrected = false;
            if (this.autoCorrect && value.indexOf('://') === -1) {
                value = 'http://' + value;
                autoCorrected = true;
            }
            let regex = /^(?:(?:https?):\/\/)(?:\S+(?::\S*)?@)?(?:(?!10(?:\.\d{1,3}){3})(?!127(?:\.\d{1,3}){3})(?!169\.254(?:\.\d{1,3}){2})(?!192\.168(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/i;
            this.valid = regex.test(value);
            if (this.valid && this.autoCorrected) {
                field.value = value;
            }
            if (!this.valid) {
                this.error = { message: 'Not a valid url.' };
            }
            return Promise.resolve(this.valid);
        }
    }
    class EmailAddressValidator {
        validate(field) {
            this.valid = /^[a-zA-Z0-9_\.\-\+]+\@([a-zA-Z0-9\-]+\.)+[a-zA-Z0-9]{2,20}$/.test(field.value);
            if (!this.valid) {
                this.error = { message: 'Not a valid email address.' };
            }
            return Promise.resolve(this.valid);
        }
    }
    class CreditCardNumberValidator {
        validate(field) {
            this.valid = Carbon.CreditCard.validate(field.value);
            if (!this.valid) {
                this.error = { message: "Not a valid credit card number." };
            }
            return Promise.resolve(this.valid);
        }
    }
    class RemoteValidator {
        constructor(url) {
            this.url = url;
        }
        validate(field) {
            this.valid = true;
            let request = new Request(this.url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: _.serialize({ value: field.value })
            });
            return fetch(request)
                .then(response => response.json())
                .then(data => {
                this.valid = data.valid;
                this.error = data.error;
                this.replacement = data.replacement;
                return Promise.resolve(this.valid);
            });
        }
    }
    class AutoComplete {
        constructor(element, options) {
            this.items = [];
            this.hoveringList = false;
            this.ghostVal = '';
            this.element = element;
            if (options && options.listEl) {
                this.listEl = options.listEl;
            }
            else {
                this.listEl = this.element.querySelector('.suggestions');
            }
            if (!this.listEl)
                throw new Error('[AutoComplete] .suggestions element not found');
            if (!options) {
                options = this.listEl.dataset;
            }
            if (!options.template)
                throw new Error('[AutoComplete] missing data-template');
            if (!options.remote)
                throw new Error('[AutoComplete] missing data-remote');
            this.template = new Carbon.Template(options.template);
            this.remote = options.remote;
            this.limit = options.limit | parseInt('5');
            this.minLength = options.minLength | parseInt('1');
            this.inputEl = this.element.querySelector('input.input');
            this.ghostEl = this.element.querySelector('input.ghost');
            this.inputEl.autocomplete = 'off';
            if (this.ghostEl) {
                this.ghostEl.value = '';
            }
            this.inputEl.addEventListener('keydown', this.onKeyDown.bind(this), true);
            this.inputEl.addEventListener('keypress', this.onKeyPress.bind(this), true);
            this.inputEl.addEventListener('input', this.onInput.bind(this), false);
            this.inputEl.addEventListener('blur', this.onBlur.bind(this), false);
            this.listEl.addEventListener('click', this.onClick.bind(this), false);
            this.listEl.addEventListener('mouseenter', () => {
                this.hoveringList = true;
            }, false);
            this.listEl.addEventListener('mouseleave', () => {
                this.hoveringList = false;
            }, false);
        }
        onClick(e) {
            let target = e.target;
            let liEl = target.closest('li');
            liEl && this.select(liEl);
        }
        onBlur(e) {
            if (this.hoveringList)
                return;
            this.close();
        }
        on(type, listener) {
            this.element.addEventListener(type, listener, false);
        }
        onInput(e) {
            let code = e.which;
            if (code === 13 || code === 30 || code === 38 || code === 40)
                return;
            let val = this.inputEl.value;
            this.updateGhost();
            if (val.length < this.minLength) {
                this._showList([]);
            }
            else {
                this.fetchSuggestions();
            }
        }
        onKeyPress(e) {
            if (this.inputEl.dataset['restrict'] === 'tag') {
                if (InputRestriction.Tag(e))
                    e.preventDefault();
            }
        }
        onKeyDown(e) {
            switch (e.which) {
                case 27:
                    this.escape(e);
                    break;
                case 9:
                    this.close();
                    break;
                case 13:
                    this.onEnter(e);
                    break;
                case 38:
                    this.up();
                    break;
                case 40:
                    this.down();
                    break;
            }
        }
        escape(e) {
            e.stopPropagation();
            e.preventDefault();
            this.close();
        }
        cancel() {
            this.ghostVal = '';
            this.close();
        }
        close() {
            this.element.classList.remove('suggesting');
            this.listEl.innerHTML = '';
        }
        updateGhost() {
            if (!this.ghostEl)
                return;
            let val = this.inputEl.value.toLowerCase();
            if (val.length === 0) {
                this.ghostEl.value = '';
            }
            if (!this.ghostVal)
                return;
            if (!this.ghostVal.toLowerCase().startsWith(val)) {
                this.ghostEl.value = '';
                return;
            }
            if (this.ghostVal.length > 0) {
                val = this.inputEl.value + this.ghostVal.substring(val.length);
            }
            this.ghostEl.value = val;
        }
        up() {
            let selectedEl = this.listEl.querySelector('.selected');
            var prevEl;
            if (selectedEl) {
                selectedEl.classList.remove('selected');
                prevEl = selectedEl.previousElementSibling;
            }
            if (!prevEl) {
                prevEl = this.listEl.children[this.listEl.children.length - 1];
            }
            this.highlight(prevEl);
        }
        down() {
            let selectedEl = this.listEl.querySelector('.selected');
            var nextEl;
            if (selectedEl) {
                selectedEl.classList.remove('selected');
                nextEl = selectedEl.nextElementSibling;
            }
            if (!nextEl) {
                nextEl = this.listEl.children[0];
            }
            this.highlight(nextEl);
        }
        highlight(el) {
            if (!el)
                return;
            el.classList.add('selected');
            el.focus();
            let value = el.dataset['value'];
            this.inputEl.value = value;
            if (this.ghostEl) {
                this.ghostEl.value = value;
            }
        }
        onEnter(e) {
            let selectedEl = this.listEl.querySelector('.selected');
            if (selectedEl) {
                e.preventDefault();
                this.select(selectedEl);
            }
        }
        select(el) {
            let value = el.dataset['value'];
            let index = parseInt(el.dataset['index']);
            this.inputEl.value = value;
            this.inputEl.focus();
            _.trigger(el, 'select', {
                value: value,
                data: this.items[index],
            });
            this.updateGhost();
            this._showList([]);
        }
        fetchSuggestions() {
            if (this.timeout) {
                clearTimeout(this.timeout);
            }
            this.timeout = setTimeout(this._fetchSuggestions.bind(this), 200);
        }
        _showList(items) {
            this.listEl.innerHTML = '';
            this.request = null;
            var val = this.inputEl.value.toLowerCase();
            this.items = items;
            this.ghostVal = '';
            var i = 0;
            for (var item of items) {
                if (this.listEl.children.length >= this.limit)
                    break;
                let el = this.template.render(item);
                let value = el.dataset['value'];
                el.dataset['index'] = i.toString();
                if (this.ghostVal = '') {
                    this.ghostVal = value;
                }
                if (value.toLowerCase().includes(val)) {
                    this.listEl.appendChild(el);
                }
                i++;
            }
            let empty = this.listEl.children.length === 0;
            _.toggleClass(this.element, 'suggesting', !empty);
            this.updateGhost();
        }
        _fetchSuggestions() {
            this.timeout = null;
            let prefix = '?';
            if (this.remote.indexOf('?') > -1)
                prefix = '&';
            let val = this.inputEl.value;
            if (val.length < this.minLength) {
                return;
            }
            let url = `${this.remote}${prefix}q=${encodeURIComponent(val)}`;
            fetch(url, { credentials: 'same-origin' })
                .then(response => response.json())
                .then(json => this._showList(json));
        }
        dispose() {
        }
    }
    Carbon.AutoComplete = AutoComplete;
    class AutoExpander {
        constructor(element, options) {
            this.maxHeight = 10000;
            this.height = 0;
            this.diff = 0;
            this.element = element;
            let populated = this.element.value.replace(/\s/g, '').length > 0;
            if (populated) {
                this.update();
            }
            this.element.addEventListener('keyup', this.onKeyUp.bind(this));
            this.element.addEventListener('scroll', this.update.bind(this));
            this.element.addEventListener('poke', this.update.bind(this));
            if (options && options.maxHeight) {
                this.maxHeight = options.maxHeight;
            }
            this.outerEl = this.element.closest('.outer');
        }
        onKeyUp(e) {
            let val = this.element.value;
            if (e.keyCode === 13 && !e.shiftKey) {
                if (val.replace(/\s/g, '').length === 0) {
                    e.stopPropagation();
                }
            }
            this.update();
        }
        update() {
            let oldHeight = this.height;
            if (this.outerEl) {
                this.outerEl.style.height = this.height + 'px';
            }
            this.element.style.height = '0px';
            let scrollHeight = this.element.scrollHeight;
            this.height = scrollHeight - this.diff;
            if (this.height > this.maxHeight) {
                this.height = this.maxHeight;
            }
            this.element.style.height = this.height + 'px';
            if (this.outerEl) {
                this.outerEl.style.height = this.height + 'px';
            }
            if (this.height != oldHeight) {
                _.trigger(this.element, 'expanded');
            }
        }
    }
    Carbon.AutoExpander = AutoExpander;
    var InputRestriction = {
        Number: (e) => !KeyEvent.isNumber(e),
        Tag(e) {
            return e.which === 33 ||
                e.which === 35 ||
                e.which === 38 ||
                e.which === 42 ||
                e.which === 47;
        }
    };
    var KeyEvent = {
        isCommand(e) {
            if (e.metaKey)
                return true;
            switch (e.which) {
                case 8: return true;
                case 48: return true;
            }
            return false;
        },
        isNumber(e) {
            if (KeyEvent.isCommand(e))
                return true;
            let char = String.fromCharCode(e.which);
            return !!/[\d\s]/.test(char);
        }
    };
    Carbon.CreditCard = {
        Types: {
            Visa: /^4[0-9]{12}(?:[0-9]{3})?$/,
            MasterCard: /^5[1-5][0-9]{14}$/,
            DinersClub: /^3(?:0[0-5]|[68][0-9])[0-9]{11}$/,
            Amex: /^3[47][0-9]{13}$/,
            Discover: /^6(?:011|5[0-9]{2})[0-9]{12}$/
        },
        validate(num) {
            num = Carbon.CreditCard.strip(num);
            return !!Carbon.CreditCard.getType(num) && Carbon.CreditCard.verifyLuhn10(num);
        },
        getLuhn10(num) {
            let revArr = num.split('').reverse();
            var total = 0;
            var tmp = 0;
            for (var i = 0; i < revArr.length; i++) {
                if ((i % 2) > 0) {
                    tmp = parseInt(revArr[i]) * 2;
                    tmp = (tmp < 9 ? tmp : (tmp - 9));
                    total += tmp;
                }
                else {
                    total += Number(revArr[i]);
                }
            }
            return total;
        },
        verifyLuhn10(num) {
            return Carbon.CreditCard.getLuhn10(num) % 10 == 0;
        },
        strip(num) {
            return num.replace(/-/g, "").replace(/ /g, "");
        },
        getType(num) {
            for (var type in Carbon.CreditCard.Types) {
                let regex = Carbon.CreditCard.Types[type];
                if (regex.test(num))
                    return type;
            }
            return null;
        }
    };
    class TokenList {
        constructor(element) {
            this.limit = 100;
            this.selectedSuggestion = false;
            this.reactive = new Carbon.Reactive();
            this.element = element;
            this.fieldEl = this.element.querySelector('.field');
            if (!this.fieldEl)
                throw new Error('[TokenList] Missing .field');
            if (this.fieldEl.querySelector('.suggestions')) {
                this.autoComplete = new AutoComplete(this.fieldEl);
                this.autoComplete.on('select', this.onSelect.bind(this));
            }
            this.inputEl = this.fieldEl.querySelector('input');
            this.listEl = this.element.matches('ul')
                ? this.element
                : this.element.querySelector('ul');
            if (!this.listEl)
                throw new Error('[TokenList] missing ul');
            this.inputEl.addEventListener('input', this.onInput.bind(this), false);
            this.inputEl.addEventListener('keydown', this.onKeyDown.bind(this), false);
            this.inputEl.addEventListener('blur', this.onBlur.bind(this), false);
            this.inputEl.addEventListener('paste', this.onPaste.bind(this), false);
            if (this.element.dataset['limit']) {
                this.limit = parseInt(this.element.dataset['limit']);
            }
            this.maxLength = this.inputEl.maxLength;
            if (this.maxLength <= 0) {
                this.maxLength = 100;
            }
            this.inputEl.style.width = this.measureText('a') + 'px';
            this.element.addEventListener('click', this.clicked.bind(this));
            let empty = this.count === 0;
            _.toggleClass(this.element, 'empty', empty);
        }
        static get(element) {
            let block = TokenList.map.get(element);
            if (!block) {
                block = new TokenList(element);
                TokenList.map.set(element, block);
            }
            return block;
        }
        onClick(e) {
            let target = e.target;
            let liEl = target.closest('li:not(.field)');
            liEl && this.clickedLi(liEl);
        }
        on(name, listener) {
            return this.reactive.on(name, listener);
        }
        get value() {
            return this.getValues();
        }
        getValues() {
            let els = this.listEl.querySelectorAll('li:not(.field)');
            return Array.from(els).map(el => {
                let textEl = el.querySelector('.text');
                return textEl ? this.canonicalize(textEl.textContent) : '';
            })
                .filter(value => !!value);
        }
        canonicalize(value) {
            return value ? value.trim() : '';
        }
        clickedLi(el) {
            this.remove(el);
        }
        clicked(e) {
            let target = e.target;
            if (target.closest('li'))
                return;
            e.stopPropagation();
            this.inputEl.select();
        }
        onSelect(e) {
            this.selectedSuggestion = true;
            setTimeout(() => {
                this.selectedSuggestion = false;
            }, 100);
            this.inputEl.value = '';
            this.add(e.detail.value);
        }
        onBlur(e) {
            setTimeout(() => {
                if (!this.selectedSuggestion) {
                    this.addCurrent();
                }
            }, 100);
        }
        addCurrent() {
            let value = this.canonicalize(this.inputEl.value);
            if (value.length === 0 || value.length > this.maxLength)
                return false;
            let isDub = this.getValues().filter(text => text === value).length !== 0;
            _.toggleClass(this.inputEl, 'dub', isDub);
            if (isDub)
                return;
            this.inputEl.value = '';
            this.inputEl.style.width = this.measureText('a') + 'px';
            this.add(value);
        }
        onKeyDown(e) {
            if (e.which === 13 || e.which === 188) {
                e.preventDefault();
                this.addCurrent();
                return false;
            }
            if (e.which === 8 && this.inputEl.value.length === 0) {
                let els = this.listEl.querySelectorAll('li:not(.field)');
                if (els.length === 0)
                    return;
                let lastEl = els[els.length - 1];
                lastEl && this.remove(lastEl);
            }
        }
        onInput() {
            this.inputEl.classList.remove('dub');
            let width = this.measureText(this.inputEl.value);
            if (this.inputEl.value.length > 0) {
                this.element.classList.remove('empty');
            }
            else if (this.count === 0) {
                this.element.classList.add('empty');
            }
            this.inputEl.style.width = width + 'px';
        }
        onPaste(e) {
            if (e.clipboardData && e.clipboardData.getData) {
                let text = e.clipboardData.getData('Text');
                if (text) {
                    this.addRange(text.split(','));
                    e.stopPropagation();
                    e.preventDefault();
                }
            }
        }
        measureText(text) {
            if (!this.tempEl) {
                let css = getComputedStyle(this.inputEl);
                let el = document.createElement('span');
                el.style.position = 'fixed';
                el.style.left = '-5000px';
                el.style.top = '-5000px';
                el.style.fontFamily = css.fontFamily;
                el.style.fontSize = css.fontSize;
                el.style.fontWeight = css.fontWeight;
                el.style.padding = css.padding;
                el.style.margin = css.margin;
                el.style.whiteSpace = 'pre';
                el.style.visibility = 'hidden';
                this.tempEl = el;
                document.body.appendChild(el);
            }
            this.tempEl.textContent = text;
            return _.width(this.tempEl) + 4;
        }
        addRange(list) {
            for (var item of list) {
                this.add(item.trim(), false);
            }
        }
        add(value, trigger) {
            if (!value || value.trim().length === 0)
                return;
            let count = this.getValues().length;
            if (count >= this.limit) {
                return;
            }
            let liEl = document.createElement('li');
            let spanEl = document.createElement('span');
            spanEl.classList.add('text');
            spanEl.textContent = value;
            liEl.appendChild(spanEl);
            let fieldEl = this.listEl.querySelector('.field');
            if (fieldEl) {
                this.listEl.insertBefore(liEl, fieldEl);
            }
            else {
                this.listEl.appendChild(liEl);
            }
            if (this.autoComplete) {
                this.autoComplete.cancel();
            }
            this.element.classList.remove('empty');
            if (trigger === false)
                return;
            this.reactive.trigger({
                type: 'add',
                value: value,
                element: liEl
            });
            this.reactive.trigger({
                type: 'change',
                kind: 'add',
                value: value,
                element: liEl
            });
        }
        clear() {
            for (var el of Array.from(this.listEl.querySelectorAll('li:not(.field)'))) {
                el.remove();
            }
            this.element.classList.add('empty');
        }
        get count() {
            return this.listEl.querySelectorAll('li:not(.field)').length;
        }
        remove(el) {
            let textEl = el.querySelector('.text');
            let value = textEl.textContent;
            el.remove();
            if (this.count === 0) {
                this.element.classList.add('empty');
                this.inputEl.select();
            }
            this.reactive.trigger({
                type: 'remove',
                value: value
            });
            this.reactive.trigger({
                type: 'change',
                kind: 'remove',
                value: value
            });
        }
        dispose() {
            if (this.tempEl) {
                this.tempEl.remove();
            }
        }
    }
    TokenList.map = new WeakMap();
    Carbon.TokenList = TokenList;
    var _;
    (function (_) {
        function debounce(func, wait, immediate) {
            var timeout;
            return function () {
                var context = this, args = arguments;
                var later = function () {
                    timeout = null;
                    if (!immediate)
                        func.apply(context, args);
                };
                var callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow)
                    func.apply(context, args);
            };
        }
        _.debounce = debounce;
        ;
        function serialize(obj) {
            return Object.keys(obj).map(k => encodeURIComponent(k) + "=" + encodeURIComponent(obj[k])).join('&');
        }
        _.serialize = serialize;
        function empty(text) {
            return !(text && text.length > 0);
        }
        _.empty = empty;
        function width(el) {
            return parseInt(getComputedStyle(el).width, 10);
        }
        _.width = width;
        function trigger(element, name, detail) {
            return element.dispatchEvent(new CustomEvent(name, {
                bubbles: true,
                detail: detail
            }));
        }
        _.trigger = trigger;
        function addClass(element, ...names) {
            for (var name of names) {
                element.classList.add(name);
            }
        }
        _.addClass = addClass;
        function toggleClass(element, name, force) {
            if (force === false) {
                element.classList.remove(name);
            }
            else if (force === true) {
                element.classList.add(name);
            }
            else {
                element.classList.toggle(name);
            }
        }
        _.toggleClass = toggleClass;
        function removeClass(element, ...names) {
            for (var name of names) {
                element.classList.remove(name);
            }
        }
        _.removeClass = removeClass;
    })(_ || (_ = {}));
})(Carbon || (Carbon = {}));
