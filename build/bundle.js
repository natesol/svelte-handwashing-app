var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* src\ProgressBar.svelte generated by Svelte v3.42.1 */

    function create_fragment$3(ctx) {
    	let div1;
    	let div0;
    	let span;
    	let t0;
    	let t1;

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			span = element("span");
    			t0 = text(/*progress*/ ctx[0]);
    			t1 = text("%");
    			attr(span, "class", "sr-only");
    			attr(div0, "class", "progress-bar svelte-14q34bf");
    			set_style(div0, "width", /*progress*/ ctx[0] + "%");
    			attr(div1, "class", "progress-bar-container svelte-14q34bf");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div0, span);
    			append(span, t0);
    			append(span, t1);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*progress*/ 1) set_data(t0, /*progress*/ ctx[0]);

    			if (dirty & /*progress*/ 1) {
    				set_style(div0, "width", /*progress*/ ctx[0] + "%");
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div1);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { progress = 0 } = $$props;

    	$$self.$$set = $$props => {
    		if ('progress' in $$props) $$invalidate(0, progress = $$props.progress);
    	};

    	return [progress];
    }

    class ProgressBar extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$3, safe_not_equal, { progress: 0 });
    	}
    }

    /* src\Timer.svelte generated by Svelte v3.42.1 */

    function create_fragment$2(ctx) {
    	let div;
    	let h2;
    	let t0;

    	let t1_value = (/*secondsLeft*/ ctx[0] > 1
    	? `${/*secondsLeft*/ ctx[0]} seconds`
    	: /*secondsLeft*/ ctx[0] === 1
    		? `${/*secondsLeft*/ ctx[0]} second`
    		: `Time's Up.`) + "";

    	let t1;
    	let t2;
    	let progressbar;
    	let t3;
    	let button;
    	let t4;
    	let current;
    	let mounted;
    	let dispose;
    	progressbar = new ProgressBar({ props: { progress: /*progress*/ ctx[2] } });

    	return {
    		c() {
    			div = element("div");
    			h2 = element("h2");
    			t0 = text("time left: ");
    			t1 = text(t1_value);
    			t2 = space();
    			create_component(progressbar.$$.fragment);
    			t3 = space();
    			button = element("button");
    			t4 = text("start");
    			attr(h2, "class", "svelte-16jsjhp");
    			button.disabled = /*isTimerRunning*/ ctx[1];
    			attr(button, "class", "svelte-16jsjhp");
    			attr(div, "class", "timer svelte-16jsjhp");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h2);
    			append(h2, t0);
    			append(h2, t1);
    			append(div, t2);
    			mount_component(progressbar, div, null);
    			append(div, t3);
    			append(div, button);
    			append(button, t4);
    			current = true;

    			if (!mounted) {
    				dispose = listen(button, "click", /*startClock*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if ((!current || dirty & /*secondsLeft*/ 1) && t1_value !== (t1_value = (/*secondsLeft*/ ctx[0] > 1
    			? `${/*secondsLeft*/ ctx[0]} seconds`
    			: /*secondsLeft*/ ctx[0] === 1
    				? `${/*secondsLeft*/ ctx[0]} second`
    				: `Time's Up.`) + "")) set_data(t1, t1_value);

    			const progressbar_changes = {};
    			if (dirty & /*progress*/ 4) progressbar_changes.progress = /*progress*/ ctx[2];
    			progressbar.$set(progressbar_changes);

    			if (!current || dirty & /*isTimerRunning*/ 2) {
    				button.disabled = /*isTimerRunning*/ ctx[1];
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(progressbar.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(progressbar.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(progressbar);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    const TOTAL_SECONDS = 20;

    function instance$1($$self, $$props, $$invalidate) {
    	let progress;
    	const dispatch = createEventDispatcher();
    	let secondsLeft = TOTAL_SECONDS;
    	let isTimerRunning = false;

    	const startClock = () => {
    		$$invalidate(1, isTimerRunning = true);

    		const timer = setInterval(
    			() => {
    				dispatch('timerTick');
    				$$invalidate(0, secondsLeft--, secondsLeft);
    				$$invalidate(2, progress = (TOTAL_SECONDS - secondsLeft) / TOTAL_SECONDS * 100);

    				if (secondsLeft === 0) {
    					clearInterval(timer);
    					dispatch('timerEnd');

    					setTimeout(
    						() => {
    							$$invalidate(0, secondsLeft = TOTAL_SECONDS);
    							$$invalidate(2, progress = 0);
    							$$invalidate(1, isTimerRunning = false);
    						},
    						1000
    					);
    				}
    			},
    			1000
    		);
    	};

    	$$invalidate(2, progress = 0);
    	return [secondsLeft, isTimerRunning, progress, startClock];
    }

    class Timer extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$2, safe_not_equal, {});
    	}
    }

    /* src\HowTo.svelte generated by Svelte v3.42.1 */

    function create_fragment$1(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			div.innerHTML = `<img bp="offset-4@md 6@md 12@sm" src="handwashing.gif" alt="steps to wash hands correctly" class="svelte-nc38fl"/>`;
    			attr(div, "bp", "grid");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    class HowTo extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$1, safe_not_equal, {});
    	}
    }

    /* src\App.svelte generated by Svelte v3.42.1 */

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let timer;
    	let t2;
    	let audio0;
    	let t3;
    	let audio1;
    	let t4;
    	let howto;
    	let current;
    	timer = new Timer({});
    	timer.$on("timerTick", /*timerTickHandler*/ ctx[2]);
    	timer.$on("timerEnd", /*timerEndHandler*/ ctx[3]);
    	howto = new HowTo({});

    	return {
    		c() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Handwashing App";
    			t1 = space();
    			create_component(timer.$$.fragment);
    			t2 = space();
    			audio0 = element("audio");
    			audio0.innerHTML = `<source src="single-tick.wav" type="audio/wav"/>`;
    			t3 = space();
    			audio1 = element("audio");
    			audio1.innerHTML = `<source src="success-bell.wav" type="audio/wav"/>`;
    			t4 = space();
    			create_component(howto.$$.fragment);
    			attr(h1, "class", "svelte-1phj1iv");
    			attr(main, "class", "svelte-1phj1iv");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, h1);
    			append(main, t1);
    			mount_component(timer, main, null);
    			append(main, t2);
    			append(main, audio0);
    			/*audio0_binding*/ ctx[4](audio0);
    			append(main, t3);
    			append(main, audio1);
    			/*audio1_binding*/ ctx[5](audio1);
    			append(main, t4);
    			mount_component(howto, main, null);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(timer.$$.fragment, local);
    			transition_in(howto.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(timer.$$.fragment, local);
    			transition_out(howto.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(main);
    			destroy_component(timer);
    			/*audio0_binding*/ ctx[4](null);
    			/*audio1_binding*/ ctx[5](null);
    			destroy_component(howto);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let audioTick;
    	let audioSuccess;

    	const timerTickHandler = () => {
    		audioTick.play();
    	};

    	const timerEndHandler = () => {
    		audioSuccess.play();
    	};

    	function audio0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			audioTick = $$value;
    			$$invalidate(0, audioTick);
    		});
    	}

    	function audio1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			audioSuccess = $$value;
    			$$invalidate(1, audioSuccess);
    		});
    	}

    	return [
    		audioTick,
    		audioSuccess,
    		timerTickHandler,
    		timerEndHandler,
    		audio0_binding,
    		audio1_binding
    	];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new App ({
        target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
