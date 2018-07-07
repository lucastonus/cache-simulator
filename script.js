$(function() {
	configs = {
		'instructionTime': 2000,
		'currentTransitionTime': 500,
		'transitionTime': 500,
		'nLogs': 100,
		'hitRatio': 75,
		'hitTime': 1,
		'missTime': 100
	}

	running = false;
	nInstructions = 0;
	nHit = 0;
	nMiss = 0;

	var deferredObjSlotsDram = appendSlotsDram();
	var deferredObjSlotsSram = appendSlotsSram();
	var deferredObjJson = initializeJson();

	$.when(deferredObjSlotsDram, deferredObjSlotsSram, deferredObjJson).done(function() {
		adjustDimensions();
		initSlotsPopovers();
		changeTransitionTime(configs.currentTransitionTime);
		bindEvents();
		updateConfigsPopovers();
	});
});

function bindEvents() {
	$('#loading').hide();
	$('#speed_slider').slider();
	$('[data-toggle="popover"]').popover();

	$('#speed_slider').on('slide', function(event, ui) {
		$('#speed_label').attr('data-speed', ui.value);
	}).on('slidestop', function(event, ui) {
		configs.currentTransitionTime = configs.transitionTime - ((ui.value / 100) * (configs.transitionTime - 50));
		changeTransitionTime(configs.currentTransitionTime.toFixed(2));
	});

	$('#btn_start').on('click', function() {
		if (!running) {
			var i = $('#qtd_instrucoes').val().replace(/[^0-9]/g, '');

			if (i > 0) {
				running = true;
				nInstructions = 0;
				$('#log p').remove();
				$('#qtd_instrucoes').attr('disabled', true);
				runSimulator(i, true);
			} else {
				showMessageBox({
					'type': 'alert',
					'text': 'O valor deve ser maior do que 0.'
				});
			}
		} else {
			showMessageBox({
				'type': 'info',
				'text': 'O simulador já está iniciado.'
			});
		}
	});

	$('#btn_stop').on('click', function() {
		nInstructions = 0;
		running = false;
		$('#qtd_instrucoes').attr('disabled', false);
		updateProgress(true);
	});

	$('#btn_update').on('click', function() {
		initUpdateMemoryData();
	});

	$('#btn_access').on('click', function() {
		var dramIndex = $('#end_mem').val().replace(/[^0-9]/g, '');

		if (!running) {
			$('#log p').remove();
			if (inRange(parseInt(dramIndex), 0, 2047)) {
				runInstruction(parseInt(dramIndex));
			} else {
				dramIndex = dramIndex.replace(/[^01]/g, '');
				if (dramIndex.length == 11) {
					runInstruction(parseInt(dramIndex, 2));
				} else {
					showMessageBox({
						'type': 'alert',
						'text': 'Digite um endereço válido.'
					});
				}
			}
		} else {
			showMessageBox({
				'type': 'info',
				'text': 'Pare o simulador antes de fazer a operação de acesso.'
			});
		}
	});

	$('#btn_clear').on('click', function() {
		if (nHit != 0 && nMiss != 0) {
			showMessageBox({
				'type': 'question',
				'text': 'Deseja realmente limpar as estatísticas registradas até o momento?',
				'fnOk': function() {
					$('#log p').remove();
					nHit = 0;
					nMiss = 0;
				}
			});
		} else {
			showMessageBox({
				'type': 'info',
				'text': 'Não existe nenhum dado registrado ainda.'
			});
		}
	});

	$('#btn_settings').on('click', function() {
		editConfigs();
	});

	$('#btn_relatorio').on('click', function() {
		if (nHit > 0 || nMiss > 0) {
			showReport();
		} else {
			showMessageBox({
				'type': 'info',
				'text': 'Não existe nenhum dado registrado ainda. Inicie o simulador antes de gerar o relatório.'
			});
		}
	});

	$(document).on('click', function (e) {
		$('[data-toggle="popover"]').each(function () {
			if (!$(this).is(e.target) && $(this).has(e.target).length === 0 && $('.popover').has(e.target).length === 0) {
				(($(this).popover('hide').data('bs.popover') || {}).inState || {}).click = false
			}
		});
	}).on('click', '#update_report', function() {
		chart.data.datasets[0].data[0] = nHit;
		chart.data.datasets[0].data[1] = nMiss;
		chart.update();
		$('#report p[n-access]').attr('n-access', (nHit + nMiss));
		$('#report p[hit-ratio]').attr('hit-ratio', (nHit / (nHit + nMiss) * 100).toFixed(2));
		$('#report p[miss-ratio]').attr('miss-ratio', (nMiss / (nHit + nMiss) * 100).toFixed(2));
		$('#report p[hit-time]').attr('hit-time', (nHit * configs.hitTime));
		$('#report p[miss-time]').attr('miss-time', (nMiss * configs.missTime));
	}).on('click', '#reset', function() {
		$('#form_settings').dialog('destroy');

		showMessageBox({
			'type': 'question',
			'text': 'Deseja realmente reiniciar?<br><b>Todos os registros serão perdidos.</b>',
			'fnOk': function() {
				location.reload();
			},
			'fnCancel': function() {
				editConfigs();
			},
			'close': function() {
				editConfigs();
			}
		});
	});

	$(document).on('blur', '#end_mem, #instruction_time, #transition_time, #n_logs, #hit_time, #miss_time', function() {
		$(this).val($(this).val().replace(/[^0-9]/g, ''));

		if ($(this).attr('id') == 'transition_time' && $(this).val() < 50) {
			$(this).val(50);
		}
	}).on('blur', '#hit_ratio', function() {
		var hit_ratio = parseFloat($(this).val().replace(/[^-0-9.]/g, '')).toFixed(2);

		if (hit_ratio > 100) {
			hit_ratio = 100;
		} else if (hit_ratio < 0) {
			hit_ratio = 0;
		}

		$(this).val(hit_ratio);
	});

	$('#end_valor').on('blur', function() {
		var letra = $(this).val().replace(/[0-9]/g, '');
		var numero = $(this).val().replace(/[^0-9]/g, '');

		if (letra.length > 0) {
			$(this).val(letra.substr(0, 1));
		} else {
			if (inRange(parseInt(numero), 0, 127)) {
				$(this).val(numero);
			} else {
				$(this).val(127);
			}
		}
	});

	$(document).on('keyup', function(e) {
		if (e.keyCode == 27) {
			$('[data-toggle="popover"]').popover('hide');
		}
	});

	$(window).on('resize', function() {
		adjustDimensions();
	});
}

function adjustDimensions() {
	var deferredObj = $.Deferred();

	width = $(window).width();
	height = $(window).height();
	dramWidth = width * 0.65;
	sramWidth = width * 0.35;
	dramHeight = sramHeight = slotsMemHeight = height - $('#controls').height();

	$('.container').css({
		'height': height + 'px',
		'width': width + 'px'
	});

	$('#slots_memoria').css({
		'height': slotsMemHeight + 'px'
	});

	$('#dram').css('width', dramWidth);
	$('#sram').css('width', sramWidth);
	$('.slot-dram').css({
		'width': (((dramWidth - 1) / 64) - 1) + 'px',
		'height': (((dramHeight - 1) / 32) - 1) + 'px'
	});
	$('.slot-sram').css({
		'width': ((($('.sram-column').width() - 1) / 4) - 1) + 'px',
		'height': (((sramHeight - 1) / 16) - 1) + 'px'
	});

	return deferredObj.resolve().promise();
}

function appendSlotsDram() {
	for (var i = 0; i < 32; i++) {
		$('#dram').append(
			$('<div>', {'class': 'row'})
		);

		for (var j = 0; j < 64; j++) {
			var index = (i * 64) + j;

			$('#dram .row:last').append(
				$('<div>', {'class': 'slot-dram', 'data-id': index, 'data-toggle': 'popover', 'data-container': 'body', 'data-html': 'true', 'data-title': 'SLOT DRAM', 'data-content': ''})
			);
		}
	}
}

function appendSlotsSram() {
	for (var i = 0; i < 2; i++) {
		$('#sram').append(
			$('<div>', {'class': 'sram-column'})
		);

		for (var j = 0; j < 16; j++) {
			$('#sram .sram-column:last').append(
				$('<div>', {'class': 'row'})
			);

			for (var k = 0; k < 4; k++) {
				$('#sram .sram-column:last .row:last').append(
					$('<div>', {'class': 'slot-sram', 'data-id': ((j * 4) + k) + (i * 64), 'data-toggle': 'popover', 'data-container': 'body', 'data-placement': 'left', 'data-html': 'true', 'data-title': 'SLOT SRAM', 'data-content': ''})
				)
			}
		}
	}
}

function initializeJson() {
	jsonDRAM = [];
	jsonSRAM = [];

	for (var i = 0; i < 2048; i++) {
		if (inRange(i, 0, 127)) {
			jsonSRAM.push({
				'address': dec2bin(i, 7),
				'tag': '0',
				'value': '0',
				'nAccess': 0,
				'valid': 0,
				'timestamp': 0
			});
		}

		jsonDRAM.push({
			'address': dec2bin(i),
			'value': generateCaracter()
		});
	}
}

function generateCaracter() {
	var random = Math.round(Math.random() * 255);

	if (Math.round(Math.random()) && (inRange(random, 65, 90) || inRange(random, 97, 122))) {
		var c = String.fromCharCode(random);
	} else {
		var c = random.toString();
	}

	return c.toString();
}

function inRange(n, nStart, nEnd) {
	if (n >= nStart && n <= nEnd) {
		return true;
	} else {
		return false;
	}
}

function dec2bin(n, digits) {
	digits = digits || 11;
	var result = n.toString(2);

	for (var i = digits - result.length; i > 0; i--) {
		result = '0' + result;
	}

	return result;
}

function runSimulator(i, first) {
	if (i > 0 && running) {
		setTimeout(function() {
			if (running) {
				if ($('#log p').length > configs.nLogs - 1) {
					$('#log p:first').remove();
				}

				runInstruction();
				runSimulator(--i, false);
			}
		}, (first ? 0 : configs.instructionTime - ($('#speed_slider').slider('value') * (configs.instructionTime / 100))));
	} else {
		running = false;
		nInstructions = 0;
		$('#qtd_instrucoes').attr('disabled', false);
	}
}

function changeTransitionTime(milliseconds) {
	$('.slot-dram, .slot-sram').css({
		'-webkit-transition': milliseconds + 'ms',
		'-moz-transition': milliseconds + 'ms',
		'-o-transition': milliseconds + 'ms',
		'transition': milliseconds + 'ms'
	});
}

function updateProgress(clear) {
	clear = clear || false;

	var calc = (nInstructions / parseInt($('#qtd_instrucoes').val())) * 100;

	if (calc == 100 || clear) {
		$('#qtd_instrucoes').css('background', '#FFF');
	} else {
		$('#qtd_instrucoes').css('background', 'linear-gradient(90deg, #55AF55 ' + calc + '%, #FFF ' + calc + '%)');
	}
}

function initSlotsPopovers() {
	for (var i = 0; i < 2048; i++) {
		if (inRange(i, 0, 127)) {
			updatePopover('sram', i);
		}

		updatePopover('dram', i);
	}
}

function updatePopover(type, index) {
	var content = $('<div>');

	if (type == 'dram') {
		content.append(
			$('<b>', {'text': 'Index: '}), index, $('<br>'),
			$('<b>', {'text': 'Endereço: '}), jsonDRAM[index].address, $('<br>'),
			$('<b>', {'text': 'Valor: '}), jsonDRAM[index].value, $('<br>')
		);
	} else {
		content.append(
			$('<b>', {'text': 'Index: '}), index, $('<br>'),
			$('<b>', {'text': 'Endereço: '}), jsonSRAM[index].address, $('<br>'),
			$('<b>', {'text': 'Tag: '}), jsonSRAM[index].tag + ' (' + parseInt(jsonSRAM[index].tag, 2) + ')', $('<br>'),
			$('<b>', {'text': 'Valor: '}), jsonSRAM[index].value, $('<br>'),
			$('<b>', {'text': 'Número de acessos: '}), jsonSRAM[index].nAccess, $('<br>'),
			$('<b>', {'text': 'Válido: '}), jsonSRAM[index].valid, $('<br>'),
			$('<b>', {'text': 'Timestamp: '}), jsonSRAM[index].timestamp, $('<br>')
		);
	}

	$('.slot-' + (type == 'dram' ? 'dram' : 'sram') + '[data-id="' + index + '"]').attr('data-content', content.html());
}

function updateConfigsPopovers() {
	$('#speed_label i').attr('data-content', '0% representa a velocidade</br>mínima de ' + configs.instructionTime + ' milissegundos.');
	$('#div_log label > i').attr('data-content', 'Quando existirem mais de ' + configs.nLogs + ' registros o log será limpo automaticamente para otimizar o tempo de execução.')
}

function initUpdateMemoryData() {
	var address = $('#end_mem').val().replace(/[^0-9]/g, '');
	var binAddress = address.replace(/[^0-1]/g, '');
	var value = $('#end_valor').val();

	if (address.length <= 4 && address.length > 0) {
		if (inRange(parseInt(address), 0, 2047)) {
			updateMemoryData(dec2bin(parseInt(address)), value);
		} else {
			showMessageBox({
				'type': 'alert',
				'text': 'Informe um valor de 0 a 2047.'
			});
		}
	} else if (binAddress.length == 11) {
		updateMemoryData(binAddress, value);
	} else {
		showMessageBox({
			'type': 'alert',
			'text': 'Digite um endereço válido.'
		});
	}
}

function updateMemoryData(dramAddress, value) {
	var index = getCacheIndex(dramAddress);
	var address = parseInt(dramAddress, 2);
	var msgSRAM = '';

	jsonDRAM[address].value = value;
	updatePopover('dram', address);

	if (index !== false && inRange(index, 0, 127)) {
		jsonSRAM[index].value = value;
		jsonSRAM[index].valid = 1;
		updatePopover('sram', index);
		msgSRAM += '<br><b>Write Through: </b>Endereço SRAM (' + index + ') atualizado.';
	}

	showMessageBox({
		'type': 'info',
		'text': 'Endereço DRAM (' + address + ') atualizado com o valor <b>' + value + '</b>.' + msgSRAM
	});
}

function getCacheIndex(dramBinaryAddress) {
	var res = false;

	$.each(jsonSRAM, function(key, obj) {
		if (res === false && obj.tag == dramBinaryAddress) {
			res = key;
		}
	});

	return res;
}

function getFreeCacheIndex() {
	var res = false;

	$.each(jsonSRAM, function(key, obj) {
		if (res === false && obj.valid == false) {
			res = key;
		}
	});

	return res;
}

function fadeMemorySlot(params) {
	var gDRAM = $('.slot-dram[data-id="' + params.gDRAM + '"]');
	var gSRAM = $('.slot-sram[data-id="' + params.gSRAM + '"]');

	gDRAM.addClass('green');
	gSRAM.addClass('green');

	if (params.rDRAM !== false) {
		var rDRAM = $('.slot-dram[data-id="' + params.rDRAM + '"]');
		rDRAM.addClass('red');
	}

	setTimeout(function() {
		gDRAM.removeClass('green');
		gSRAM.removeClass('green');

		if (params.rDRAM !== false) {
			rDRAM.removeClass('red');
		}
	}, configs.currentTransitionTime);
}

function runInstruction(i) {
	var input = inRange(i, 0, 2047);
	var freeCacheIndex = getFreeCacheIndex();
	var dramIndex = (input ? i : getDramIndex(freeCacheIndex));
	var cacheIndex = getCacheIndex(dec2bin(dramIndex));
	var rDRAM = false;

	if (input === false) {
		nInstructions++;
		updateProgress();
	}

	if (cacheIndex !== false) {
		var gSRAM = cacheIndex;
		var log = '<b class="hit">HIT: </b>Endereço DRAM ' + ' (' + dramIndex + ') já está na SRAM no endereço ' + ' (' + cacheIndex + ').';

		jsonSRAM[cacheIndex].nAccess++;
		nHit++;
	} else {
		if (freeCacheIndex !== false) {
			var gSRAM = freeCacheIndex;
		} else {
			var gSRAM = getCacheIndexToChange();
			var rDRAM = parseInt(jsonSRAM[gSRAM].tag, 2);
		}

		var log = '<b class="miss">MISS: </b>Endereço DRAM ' + ' (' + dramIndex + '). Adicionado no endereço ' + ' (' + gSRAM + ') ' + (freeCacheIndex !== false ? 'livre' : 'ocupado') + ' da SRAM.';

		jsonSRAM[gSRAM].nAccess = 0;
		jsonSRAM[gSRAM].tag = dec2bin(dramIndex);
		jsonSRAM[gSRAM].timestamp = $.now();
		jsonSRAM[gSRAM].valid = 1;
		jsonSRAM[gSRAM].value = jsonDRAM[dramIndex].value;
		nMiss++;
	}

	updatePopover('sram', gSRAM);

	fadeMemorySlot({
		'gDRAM': dramIndex,
		'gSRAM': gSRAM,
		'rDRAM': rDRAM
	});

	if (configs.nLogs > 0) {
		$('#log').append(
			$('<p>', {'html': log, 'attr-n': nInstructions})
		).scrollTop(configs.nLogs * 15);
	}
}

function getCacheIndexToChange() {
	var res = 0;

	$.each(jsonSRAM, function(iKey, iObj) {
		$.each(jsonSRAM, function(jKey, jObj) {
			if (iObj.nAccess <= jObj.nAccess && iObj.nAccess <= jsonSRAM[res].nAccess) {
				if (iObj.nAccess < jObj.nAccess && iObj.nAccess < jsonSRAM[res].nAccess) {
					res = iKey;
				} else {
					if (iObj.timestamp < jObj.timestamp && iObj.timestamp < jsonSRAM[res].timestamp) {
						res = iKey;
					} else if (jObj.timestamp < iObj.timestamp && jObj.timestamp < jsonSRAM[res].timestamp) {
						res = jKey;
					}
				}
			}
		});
	});

	return res;
}

function getDramIndex(freeCache) {
	if (parseFloat((Math.random() * 100).toFixed(2)) <= configs.hitRatio && freeCache === false) {
		var res = parseInt(jsonSRAM[Math.round(Math.random() * 127)].tag, 2);
	} else {
		if (configs.hitRatio == 0) {
			var cached = true;

			while (cached) {
				var i = Math.round(Math.random() * 2047);

				if (getCacheIndex(dec2bin(i)) === false) {
					cached = false;
					var res = i;
				}
			}
		} else {
			var res = Math.round(Math.random() * 2047);
		}
	}

	return res;
}

function editConfigs() {
	showDialog({
		'content': $('<div>', {'id': 'form_settings'}).append(
			$('<div>', {'class': 'item-form'}).append(
				$('<label>', {'class': 'label-item-form', 'text': 'Tempo máximo de cada instrução (ms)'}).append(
					$('<i>', {'class': 'fas fa-info-circle', 'data-toggle': 'popover', 'data-container': 'body', 'data-html': 'true', 'data-content': 'Representado em milissegundos.', 'data-trigger': 'hover'})
				),
				$('<input>', {'type': 'text', 'id': 'instruction_time', 'name': 'instruction_time', 'maxlength': '7'})
			),
			$('<div>', {'class': 'item-form'}).append(
				$('<label>', {'class': 'label-item-form', 'text': 'Tempo máximo dos efeitos (ms)'}).append(
					$('<i>', {'class': 'fas fa-info-circle', 'data-toggle': 'popover', 'data-container': 'body', 'data-html': 'true', 'data-content': 'Representado em milissegundos. Mínimo de 50.', 'data-trigger': 'hover'})
				),
				$('<input>', {'type': 'text', 'id': 'transition_time', 'name': 'transition_time', 'maxlength': '7'})
			),
			$('<div>', {'class': 'item-form'}).append(
				$('<label>', {'class': 'label-item-form', 'text': 'Hit ratio (%)'}).append(
					$('<i>', {'class': 'fas fa-info-circle', 'data-toggle': 'popover', 'data-container': 'body', 'data-html': 'true', 'data-content': 'Porcentagem esperada de acertos da cache.', 'data-trigger': 'hover'})
				),
				$('<input>', {'type': 'text', 'id': 'hit_ratio', 'name': 'hit_ratio', 'maxlength': '6'})
			),
			$('<div>', {'class': 'item-form'}).append(
				$('<label>', {'class': 'label-item-form', 'text': 'Número máximo de logs para exibição'}).append(
					$('<i>', {'class': 'fas fa-info-circle', 'data-toggle': 'popover', 'data-container': 'body', 'data-html': 'true', 'data-content': 'Quanto maior a quantidade, menor o desempenho, em velocidade máxima.', 'data-trigger': 'hover'})
				),
				$('<input>', {'type': 'text', 'id': 'n_logs', 'name': 'n_logs', 'maxlength': '7'})
			),
			$('<div>', {'class': 'item-form'}).append(
				$('<label>', {'class': 'label-item-form', 'text': 'Hit time (ns)'}).append(
					$('<i>', {'class': 'fas fa-info-circle', 'data-toggle': 'popover', 'data-container': 'body', 'data-html': 'true', 'data-content': 'Tempo utilizado para cálculos exibidos no relatório.', 'data-trigger': 'hover'})
				),
				$('<input>', {'type': 'text', 'id': 'hit_time', 'name': 'hit_time', 'maxlength': '5'})
			),
			$('<div>', {'class': 'item-form'}).append(
				$('<label>', {'class': 'label-item-form', 'text': 'Miss time (ns)'}).append(
					$('<i>', {'class': 'fas fa-info-circle', 'data-toggle': 'popover', 'data-container': 'body', 'data-html': 'true', 'data-content': 'Tempo utilizado para cálculos exibidos no relatório.', 'data-trigger': 'hover'})
				),
				$('<input>', {'type': 'text', 'id': 'miss_time', 'name': 'miss_time', 'maxlength': '5'})
			),
			$('<div>', {'class': 'item-form'}).append(
				$('<button>', {'type': 'button', 'id': 'reset', 'class': 'dialog-button ui-button ui-corner-all ui-widget float_right', 'text': 'REINICIAR SIMULADOR'})
			)
		),
		'title': 'Configurações do simulador',
		'create': function() {
			$('#form_settings [data-toggle="popover"]').popover();
			$('#instruction_time').val(configs.instructionTime);
			$('#transition_time').val(configs.transitionTime);
			$('#hit_ratio').val(configs.hitRatio).blur();
			$('#n_logs').val(configs.nLogs);
			$('#hit_time').val(configs.hitTime);
			$('#miss_time').val(configs.missTime);
		},
		'fnOk': function() {
			configs.instructionTime = parseInt($('#instruction_time').val());
			configs.transitionTime = parseInt($('#transition_time').val());
			configs.hitRatio = parseFloat(parseFloat($('#hit_ratio').val()).toFixed(2));
			configs.nLogs = parseInt($('#n_logs').val());
			configs.hitTime = parseInt($('#hit_time').val());
			configs.missTime = parseInt($('#miss_time').val());
			afterUpdateConfigs();
		}
	});
}

function afterUpdateConfigs() {
	var nLogs = $('#log p').length;
	configs.currentTransitionTime = configs.transitionTime - (($('#speed_slider').slider('value') / 100) * (configs.transitionTime - 50));
	changeTransitionTime(configs.currentTransitionTime.toFixed(2));
	updateConfigsPopovers();

	for (var i = 0; i < nLogs - configs.nLogs; i++) {
		$('#log p:first').remove();
	}
}

function showReport() {
	showDialog({
		'content': $('<div>', {'id': 'report'}).append(
			$('<canvas>', {'id': 'report_chart'}),
			$('<div>', {'class': 'item-form padding-top15'}).append(
				$('<p>', {'html': '<b>Número de acessos: </b>', 'n-access': (nHit + nMiss)}),
				$('<p>', {'html': '<b>Hit ratio: </b>', 'hit-ratio': (nHit / (nHit + nMiss) * 100).toFixed(2)}),
				$('<p>', {'html': '<b>Miss ratio: </b>', 'miss-ratio': (nMiss / (nHit + nMiss) * 100).toFixed(2)}),
				$('<p>', {'html': '<b>Hit time: </b>', 'hit-time': (nHit * configs.hitTime)}),
				$('<p>', {'html': '<b>Miss time: </b>', 'miss-time': (nMiss * configs.missTime)})
			),
			$('<div>', {'class': 'item-form'}).append(
				$('<button>', {'type': 'button', 'id': 'update_report', 'class': 'dialog-button ui-button ui-corner-all ui-widget float_right', 'text': 'ATUALIZAR ESTATÍSTICAS'})
			)
		),
		'title': 'Relatório',
		'create': function() {
			var ctx = document.getElementById('report_chart').getContext('2d');

			chart = new Chart(ctx, {
			    'type': 'doughnut',
			    'data': {
					'datasets': [{
						'data': [nHit, nMiss],
						'backgroundColor': [
							'rgba(50, 181, 97, 1)',
			                'rgba(181, 49, 49, 1)'
			            ],
			            'borderColor': [
			                'rgba(50, 181, 97, 1)',
			                'rgba(181, 49, 49, 1)'
			            ]
					}],
					'labels': ['Hit', 'Miss']
				},
				'options': {
					'title': {
						'display': true,
						'text': 'Gráfico da quantidade de HIT e MISS',
						'fontSize': 15
					}
				}
			});
		},
		'height': 430,
		'hideCancel': true
	});
}

function showMessageBox(params) {
	showDialog({
		'content': $('<div>').append(
			$('<div>', {'class': 'col-xs-12 padding0'}).append(
				$('<div>', {'class': 'message-box box-' + params.type}).append(
					$('<p>', {'html': params.text})
				)
			)
		),
		'title': (params.type == 'question' ? 'Confirmação' : 'Atenção'),
		'hideCancel': (params.type == 'question' ? false : true),
		'fnOk': function() {
			if (params.fnOk) {
				params.fnOk();
			}
		},
		'fnCancel': function() {
			if (params.fnCancel) {
				params.fnCancel();
			}
		},
		'close': function() {
			if (params.close) {
				params.close();
			}
		}
	});
}

function showDialog(dialog) {
	var buttons = [];

	buttons[0] = {
		'id': 'dialog_btnOk',
		'class': 'dialog-ok',
		'text': (dialog.textOk ? dialog.textOk : 'OK'),
		'click': function() {
			if (dialog.fnOk) {
				dialog.fnOk();
			}
			$(this).dialog('destroy');
		}
	}

	if (!dialog.hideCancel) {
		buttons[1] = {
			'id': 'dialog_btnCancel',
			'class': 'dialog-cancel',
			'text': (dialog.textCancel ? dialog.textCancel : 'CANCELAR'),
			'click': function() {
				if (dialog.fnCancel) {
					dialog.fnCancel();
				}
				$(this).dialog('destroy');
			}
		}
	}

	$(dialog.content).dialog({
		'resizable': false,
		'height': dialog.height || 'auto',
		'width': dialog.width || 440,
		'modal': true,
		'buttons': buttons,
		'hideCancel': dialog.hideCancel || false,
		'title': dialog.title,
		'close': function() {
			if (dialog.close) {
				dialog.close();
			}
			$(this).dialog('destroy');
		},
		'create': function() {
			if (dialog.create) {
				dialog.create();
			}
		}
	});
}