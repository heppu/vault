import Component from '@glimmer/component';
import { action } from '@ember/object';
import { stack } from 'd3-shape';
// eslint-disable-next-line no-unused-vars
import { select, event, selectAll } from 'd3-selection';
import { scaleLinear, scaleBand } from 'd3-scale';
import { axisLeft } from 'd3-axis';
import { max, maxIndex } from 'd3-array';
import { BAR_COLOR_HOVER, GREY, LIGHT_AND_DARK_BLUE } from '../../utils/chart-helpers';
import { tracked } from '@glimmer/tracking';

/**
 * @module HorizontalBarChart
 * HorizontalBarChart components are used to display data in the form of a horizontal, stacked bar chart with accompanying tooltip.
 *
 * @example
 * ```js
 * <HorizontalBarChart @dataset={{@dataset}} @chartLegend={{@chartLegend}}/>
 * ```
 * @param {array} dataset - dataset for the chart, must be an array of flattened objects
 * @param {array} chartLegend - array of objects with key names 'key' and 'label' so data can be stacked
 */

// TODO: delete original bar chart component

// SIZING CONSTANTS
const CHART_MARGIN = { top: 10, left: 95 }; // makes space for y-axis legend
const TRANSLATE = { down: 13 };
const CHAR_LIMIT = 15; // character count limit for y-axis labels to trigger truncating
const LINE_HEIGHT = 24; // each bar w/ padding is 24 pixels thick

export default class HorizontalBarChart extends Component {
  @tracked tooltipTarget = '';
  @tracked tooltipText = '';

  get labelKey() {
    return this.args.labelKey || 'label';
  }

  get chartLegend() {
    return this.args.chartLegend;
  }

  get topNamespace() {
    return this.args.dataset[maxIndex(this.args.dataset, (d) => d.total)];
  }

  @action removeTooltip() {
    this.tooltipTarget = null;
  }

  @action
  renderChart(element, args) {
    // chart legend tells stackFunction how to stack/organize data
    // creates an array of data for each key name
    // each array contains coordinates for each data bar
    let stackFunction = stack().keys(this.chartLegend.map((l) => l.key));
    let dataset = args[0];
    let stackedData = stackFunction(dataset);
    let labelKey = this.labelKey;

    let xScale = scaleLinear()
      .domain([0, max(dataset.map((d) => d.total))])
      .range([0, 75]); // 25% reserved for margins

    let yScale = scaleBand()
      .domain(dataset.map((d) => d[labelKey]))
      .range([0, dataset.length * LINE_HEIGHT])
      .paddingInner(0.765); // percent of the total width to reserve for padding between bars

    let chartSvg = select(element);
    chartSvg.attr('width', '100%').attr('viewBox', `0 0 564 ${(dataset.length + 1) * LINE_HEIGHT}`);
    // chartSvg.attr('viewBox', `0 0 700 300`);

    let groups = chartSvg
      .selectAll('g')
      .remove()
      .exit()
      .data(stackedData)
      .enter()
      .append('g')
      // shifts chart to accommodate y-axis legend
      .attr('transform', `translate(${CHART_MARGIN.left}, ${CHART_MARGIN.top})`)
      .style('fill', (d, i) => LIGHT_AND_DARK_BLUE[i]);

    let yAxis = axisLeft(yScale).tickSize(0);
    yAxis(chartSvg.append('g').attr('transform', `translate(${CHART_MARGIN.left}, ${CHART_MARGIN.top})`));

    chartSvg.select('.domain').remove();

    let truncate = (selection) =>
      selection.text((string) =>
        string.length < CHAR_LIMIT ? string : string.slice(0, CHAR_LIMIT - 3) + '...'
      );

    chartSvg.selectAll('.tick text').call(truncate);

    groups
      .selectAll('rect')
      // iterate through the stacked data and chart respectively
      .data((stackedData) => stackedData)
      .enter()
      .append('rect')
      .attr('class', 'data-bar')
      .style('cursor', 'pointer')
      .attr('width', (chartData) => `${xScale(chartData[1] - chartData[0]) - 0.25}%`)
      .attr('height', yScale.bandwidth())
      .attr('x', (chartData) => `${xScale(chartData[0])}%`)
      .attr('y', ({ data }) => yScale(data[labelKey]))
      .attr('rx', 3)
      .attr('ry', 3);

    let actionBars = chartSvg
      .selectAll('.action-bar')
      .data(dataset)
      .enter()
      .append('rect')
      .style('cursor', 'pointer')
      .attr('class', 'action-bar')
      .attr('width', '100%')
      .attr('height', `${LINE_HEIGHT}px`)
      .attr('x', '0')
      .attr('y', (chartData) => yScale(chartData[labelKey]))
      .style('fill', `${GREY}`)
      .style('opacity', '0')
      .style('mix-blend-mode', 'multiply');

    let yLegendBars = chartSvg
      .selectAll('.label-bar')
      .data(dataset)
      .enter()
      .append('rect')
      .style('cursor', 'pointer')
      .attr('class', 'label-action-bar')
      .attr('width', CHART_MARGIN.left)
      .attr('height', `${LINE_HEIGHT}px`)
      .attr('x', '0')
      .attr('y', (chartData) => yScale(chartData[labelKey]))
      .style('opacity', '0')
      .style('mix-blend-mode', 'multiply');

    let dataBars = chartSvg.selectAll('rect.data-bar');
    let actionBarSelection = chartSvg.selectAll('rect.action-bar');

    let compareAttributes = (elementA, elementB, attr) =>
      select(elementA).attr(`${attr}`) === select(elementB).attr(`${attr}`);

    // MOUSE EVENTS FOR DATA BARS
    actionBars
      .on('mouseover', (data) => {
        let hoveredElement = actionBars.filter((bar) => bar.label === data.label).node();
        this.tooltipTarget = hoveredElement;
        this.tooltipText = `${Math.round((data.total * 100) / 19000)}% of total client counts:
        ${data.non_entity_tokens} non-entity tokens, ${data.distinct_entities} unique entities.`;

        select(hoveredElement).style('opacity', 1);

        dataBars
          .filter(function () {
            return compareAttributes(this, hoveredElement, 'y');
          })
          .style('fill', (b, i) => `${BAR_COLOR_HOVER[i]}`);
      })
      .on('mouseout', function () {
        select(this).style('opacity', 0);
        dataBars
          .filter(function () {
            return compareAttributes(this, event.target, 'y');
          })
          .style('fill', (b, i) => `${LIGHT_AND_DARK_BLUE[i]}`);
      });

    // MOUSE EVENTS FOR Y-AXIS LABELS
    yLegendBars
      .on('mouseover', (data) => {
        if (data.label.length >= CHAR_LIMIT) {
          let hoveredElement = yLegendBars.filter((bar) => bar.label === data.label).node();
          this.tooltipTarget = hoveredElement;
          this.tooltipText = data.label;
        } else {
          this.tooltipTarget = null;
        }
        dataBars
          .filter(function () {
            return compareAttributes(this, event.target, 'y');
          })
          .style('fill', (b, i) => `${BAR_COLOR_HOVER[i]}`);
        actionBarSelection
          .filter(function () {
            return compareAttributes(this, event.target, 'y');
          })
          .style('opacity', '1');
      })
      .on('mouseout', function () {
        this.tooltipTarget = null;
        dataBars
          .filter(function () {
            return compareAttributes(this, event.target, 'y');
          })
          .style('fill', (b, i) => `${LIGHT_AND_DARK_BLUE[i]}`);
        actionBarSelection
          .filter(function () {
            return compareAttributes(this, event.target, 'y');
          })
          .style('opacity', '0');
      });

    // add client count total values to the right
    chartSvg
      .append('g')
      .attr('transform', `translate(${CHART_MARGIN.left}, ${TRANSLATE.down})`)
      .selectAll('text')
      .data(dataset)
      .enter()
      .append('text')
      .text((d) => d.total)
      .attr('fill', '#000')
      .attr('class', 'total-value')
      .style('font-size', '.8rem')
      .attr('text-anchor', 'start')
      .attr('alignment-baseline', 'middle')
      .attr('x', (chartData) => `${xScale(chartData.total)}%`)
      .attr('y', (chartData) => yScale(chartData.label));
  }
}
