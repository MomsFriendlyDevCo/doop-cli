var monoxide = require('monoxide');

module.exports = monoxide.schema('widgets', {
	created: {type: Date, default: Date.now},
	status: {type: 'string', enum: ['active', 'deleted'], default: 'active', index: true},
	title: {type: 'string'},
})
