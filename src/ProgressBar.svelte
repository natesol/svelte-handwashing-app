<script>

    export let progress = 0;

</script>

<style>

    .progress-bar-container {
        width: 100%;
        height: 2rem;
        margin: 1rem 0 2rem;
        border: solid 1px var(--clr-black-100);
        border-radius: 3rem;
        overflow: hidden;
    }
    .progress-bar {
        background: var(--clr-green);
        width: 23%;
        height: 100%;
    }

</style>

<div class="progress-bar-container">

    <div class="progress-bar" style="width: {progress}%;">
        <span class="sr-only">{progress}%</span>
    </div>

</div>
