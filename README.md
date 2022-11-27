# scale-workshop-core
Core library for creating microtonal scales without the Vue front-end.

## Installation ##
```bash
npm i
```

## Documentation ##
Documentation is hosted at the project [Github pages](https://xenharmonic-devs.github.io/scale-workshop-core).

To generate documentation locally run:
```bash
npm run doc
```

## Philosophy ##
One issue with universal pitch types is precision. You cannot use fractions directly if you want to pump commas. Let's take 81/80 for example. Pump it five times and you already get 3486784401/3276800000. Just imagine doing it 20 more times and you get numerators and denominators that break most fraction implementations. This is why Scale Workshop uses monzos internally. You'd also want equal temperaments to be represented exactly to avoid floating point issues in the monzo components so SW uses fractions for that. Observe that 1\3 = [1/3 0 0 ...>. You can't have infinite monzos so SW multiplies in a residual fraction for representing higher primes. Not everything is JI or ET so there's one more component for arbitrary cent offsets as a floating point number.
