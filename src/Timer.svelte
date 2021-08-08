<script>

    import ProgressBar from "./ProgressBar.svelte";

</script>

<style>

    .timer {
        margin: 1rem 0 2rem 0;
        width: 100%;
        max-width: 20rem;
    }

    h2 {
        margin: 0;
    }

    button {
        background: var(--clr-primary);
        background: linear-gradient(90deg, var(--clr-accent) 0%, var(--clr-primary) 100%);
        color: var(--clr-txt-onDark);
        font-size: 1.2rem;
        width: 100%;
    }

</style>


<div class="timer">

    <h2>time left: <span id="timer-sec">20 seconds</span></h2>

    <ProgressBar />

    <button>start</button>

</div>
