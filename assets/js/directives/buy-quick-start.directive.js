angular.module('walletDirectives')
  .directive('buyQuickStart', buyQuickStart);

buyQuickStart.$inject = ['$rootScope', 'currency', 'buySell', 'Alerts', '$interval', '$timeout', '$q', 'modals', 'Exchange'];

function buyQuickStart ($rootScope, currency, buySell, Alerts, $interval, $timeout, $q, modals, Exchange) {
  const directive = {
    restrict: 'E',
    replace: true,
    scope: {
      buy: '&',
      disabled: '=',
      tradingDisabled: '=',
      tradingDisabledReason: '=',
      openPendingTrade: '&',
      pendingTrade: '=',
      modalOpen: '=',
      transaction: '=',
      changeCurrency: '&',
      getDays: '&'
    },
    templateUrl: 'templates/buy-quick-start.pug',
    link: link
  };
  return directive;

  function link (scope, elem, attr) {
    scope.exchangeRate = {};
    scope.status = {ready: true};
    scope.currencies = currency.coinifyCurrencies;
    scope.format = currency.formatCurrencyForView;
    scope.inMobileBuy = $rootScope.inMobileBuy;
    scope.symbol = currency.conversions[scope.transaction.currency.code].symbol;

    scope.updateLastInput = (type) => scope.lastInput = type;
    scope.isPendingTradeState = (state) => scope.pendingTrade && scope.pendingTrade.state === state && scope.pendingTrade.medium !== 'blockchain';
    scope.isPendingSellTrade = () => buySell.isPendingSellTrade(scope.pendingTrade);

    scope.getInitialExchangeRate = () => {
      scope.status.busy = true;

      buySell.getQuote(-1, 'BTC', scope.transaction.currency.code).then((quote) => {
        scope.getMinLimits(quote);
        scope.exchangeRate.fiat = (-quote.quoteAmount / 100).toFixed(2);
      }, error).finally(scope.getQuote);
    };

    scope.getExchangeRate = () => {
      let rate, fiat;
      let { baseAmount, quoteAmount, baseCurrency } = scope.quote;

      if (baseCurrency === 'BTC') {
        rate = 1 / (baseAmount / 100000000);
        fiat = quoteAmount / 100;
      } else {
        rate = 1 / (quoteAmount / 100000000);
        fiat = baseAmount / 100;
      }

      return Math.abs((rate * fiat)).toFixed(2);
    };

    scope.isCurrencySelected = (currency) => currency === scope.transaction.currency;

    scope.handleCurrencyClick = (curr) => {
      scope.changeCurrency(curr);
      scope.refreshSymbol();
    };

    scope.refreshSymbol = () => {
      scope.symbol = currency.conversions[scope.transaction.currency.code].symbol;
    };

    scope.getQuote = () => {
      scope.status.busy = true;

      if (scope.lastInput === 'btc') {
        $q.resolve(buySell.getQuote(-scope.transaction.btc, 'BTC', scope.transaction.currency.code)).then(success, error);
      } else {
        $q.resolve(buySell.getQuote(scope.transaction.fiat, scope.transaction.currency.code)).then(success, error);
      }
    };

    const success = (quote) => {
      scope.status = {};
      scope.quote = quote;
      scope.getMinLimits(quote);
      scope.exchangeRate.fiat = scope.getExchangeRate();

      if (quote.baseCurrency === 'BTC') {
        scope.transaction.fiat = -quote.quoteAmount / 100;
      } else {
        scope.transaction.btc = quote.quoteAmount / 100000000;
      }

      Alerts.clear();
    };

    const error = (err) => {
      let error = Exchange.interpretError(err);
      if (error === 'service_temporarily_unavailable') {
        scope.serviceSuspended = true;
        scope.serviceSuspendedReason = error;
      } else {
        scope.status = {};
        scope.fiatForm.fiat.$setValidity('max', false);
      }
    };

    scope.cancelTrade = () => {
      scope.disabled = true;
      $q.resolve(buySell.cancelTrade(scope.pendingTrade))
        .finally(() => scope.disabled = false);
    };

    scope.setFiat = (amount) => {
      scope.transaction.fiat = amount;
    };

    scope.getMinLimits = (quote) => {
      $q.resolve(buySell.getMinLimits(quote))
        .then(scope.limits = buySell.limits);
    };

    scope.getInitialExchangeRate();
  }
}
