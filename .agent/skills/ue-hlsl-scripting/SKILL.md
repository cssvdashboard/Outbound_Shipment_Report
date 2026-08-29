---
name: ue-hlsl-scripting
description: Use this skill when reasoning about, writing, debugging, optimizing, or integrating HLSL shaders, Material Custom Nodes, Material Functions, and .usf/.ush shader development for Unreal Engine (UE5).
---
# HLSL Scripting for Unreal Engine 5.7.x — Intensive Skill

## 1. Skill Identity

This skill defines how to reason about, write, debug, optimize, explain, and integrate HLSL shaders for Unreal Engine 5.7.x.

Primary target:
- Unreal Engine 5.7.x, especially 5.7.4
- Material Custom Nodes
- Material Functions and shader logic
- `.usf` / `.ush` shader development when appropriate
- Runtime material effects
- Archviz-oriented materials, masks, procedural effects, emissive control, weather, glass, decals, foliage, water, post-process materials, and stylized effects
- Production-scale shader authoring with performance and platform compatibility in mind

The assistant must treat Unreal HLSL as **UE-integrated HLSL**, not generic standalone HLSL. Unreal's material compiler, generated shader code, macros, parameter plumbing, shader permutations, rendering paths, and platform abstraction all matter.

---

## 2. Core Objective

When helping with Unreal HLSL:

1. Produce correct UE-compatible HLSL.
2. Prefer the simplest solution that is robust and maintainable.
3. Understand the Material Graph context before writing code.
4. Distinguish generic HLSL syntax from Unreal-specific shader APIs/macros.
5. Track scalar, vector, matrix, texture, sampler, and material parameter types explicitly.
6. Consider shader stage, material domain, blend mode, shading model, and rendering path.
7. Consider precision, instruction count, texture samples, branches, divergence, and shader permutations.
8. Avoid code that depends on undocumented behavior unless clearly identified.
9. Make code suitable for UE 5.7.x rather than blindly copying code from older Unreal versions.
10. When debugging, return a complete corrected replacement rather than an isolated patch.

---

# 3. Operating Model

Always reason through this sequence:

`User Goal → Material Context → Inputs → Math → UE Integration → Performance → Compatibility → Complete Code → Integration Instructions → Validation`

Before writing shader code, identify:

- Material Domain
- Blend Mode
- Shading Model
- Surface vs Emissive vs Opacity vs World Position output
- Whether code runs in a Custom node or `.usf/.ush`
- Input types
- Coordinate space
- Expected value range
- Whether values are linear or sRGB
- Whether a texture is sampled or supplied as a material input
- Whether time, camera position, world position, vertex data, or screen position is involved
- Whether the effect must work in Lumen, Path Tracer, Nanite scenes, mobile, VR, or packaged builds
- Whether temporal stability matters
- Whether the effect is view-dependent

If important context is missing, ask targeted questions. If the intent is obvious and the missing information does not materially affect correctness, proceed with reasonable assumptions and state them.

---

# 4. HLSL Fundamentals

## 4.1 Scalar Types

Common types:

- `float`
- `float2`
- `float3`
- `float4`
- `int`
- `uint`
- `bool`

Use vector types deliberately.

Examples:

```hlsl
float Mask = 0.5;
float2 UV = float2(0.5, 0.25);
float3 Normal = float3(0.0, 0.0, 1.0);
float4 Color = float4(1.0, 0.0, 0.0, 1.0);
```

Do not casually mix scalar and vector values when a specific dimensionality is intended.

---

## 4.2 Constructors

Use explicit constructors:

```hlsl
float3 A = float3(1.0, 0.0, 0.0);
float4 B = float4(A, 1.0);
```

Avoid ambiguous implicit conversions when writing production shader code.

---

## 4.3 Swizzling

Understand component access:

```hlsl
float R = Color.r;
float3 RGB = Color.rgb;
float2 RG = Color.rg;
float3 BGR = Color.bgr;
```

Useful for masks:

```hlsl
float3 MaskRGB = TextureColor.rgb;
float R = MaskRGB.r;
float G = MaskRGB.g;
float B = MaskRGB.b;
```

---

# 5. Arithmetic and Core Math

Know these operations thoroughly:

- `+`
- `-`
- `*`
- `/`
- `%`
- `abs`
- `min`
- `max`
- `clamp`
- `saturate`
- `floor`
- `ceil`
- `frac`
- `round`
- `sqrt`
- `pow`
- `exp`
- `log`
- `sin`
- `cos`
- `tan`

Example:

```hlsl
float Mask = saturate(Value);
```

Prefer `saturate(x)` when the intended range is exactly `[0, 1]`.

---

# 6. Interpolation

Understand:

```hlsl
lerp(A, B, Alpha)
```

Equivalent concept:

`A * (1 - Alpha) + B * Alpha`

Examples:

```hlsl
float Result = lerp(0.0, 1.0, Mask);
float3 Color = lerp(ColorA, ColorB, Mask);
```

Do not confuse `lerp` with remapping.

For remapping:

```hlsl
float Remapped = lerp(NewMin, NewMax, saturate((Value - OldMin) / (OldMax - OldMin)));
```

Protect against zero-width ranges where required.

---

# 7. Remapping and Mask Shaping

Common pattern:

```hlsl
float Mask = saturate((Value - MinValue) / max(MaxValue - MinValue, 0.00001));
```

Soft threshold:

```hlsl
float Mask = smoothstep(MinValue, MaxValue, Value);
```

Hard threshold:

```hlsl
float Mask = step(Threshold, Value);
```

For artistic control:

```hlsl
Mask = pow(saturate(Mask), Contrast);
```

Always consider whether `pow` is appropriate for the intended range.

---

# 8. Vector Math

Master:

- `dot`
- `cross`
- `normalize`
- `length`
- `distance`
- `reflect`
- `refract`

Examples:

```hlsl
float NdotL = saturate(dot(Normal, LightDirection));
```

```hlsl
float3 Reflected = reflect(ViewDirection, Normal);
```

For normalized directions:

```hlsl
float3 Direction = normalize(Target - Position);
```

Avoid repeatedly normalizing values that are already guaranteed normalized.

---

# 9. Color Mathematics

Treat RGB as data, not simply as visual color.

Useful luminance approximation:

```hlsl
float Luma = dot(Color.rgb, float3(0.299, 0.587, 0.114));
```

For perceptual workflows, distinguish:

- linear color
- sRGB
- luminance
- exposure-scaled values
- HDR values
- normalized masks

Never blindly clamp HDR values.

For masks:

```hlsl
float3 RGBMask = TextureColor.rgb;
float R = RGBMask.r;
float G = RGBMask.g;
float B = RGBMask.b;
```

When the goal is channel identity rather than brightness, do not use luminance.

---

# 10. Texture Sampling in Unreal

UE material Custom Nodes operate inside Unreal's generated shader context.

Do not assume generic standalone HLSL texture declarations are available.

For Custom Nodes, texture inputs are normally passed from the Material Graph.

Typical conceptual pattern:

```hlsl
float4 Color = TextureColor;
```

If the input is a Texture Object, use the Unreal-compatible sampling mechanism available for that node/context rather than inventing a standalone `Texture2D` declaration.

For production code:

- Know whether the input is Texture Object, Texture Sample output, or ordinary vector data.
- Know whether UVs are supplied separately.
- Avoid unnecessary texture samples.
- Reuse sampled values.
- Consider mip behavior.
- Consider filtering and sampler state.
- Consider virtual textures separately.
- Do not assume a texture sample is cheap.

---

# 11. UV and Coordinate Systems

Understand:

- Texture UV
- Absolute World Position
- World Position
- Camera-relative coordinates
- Object/local space
- Tangent space
- Screen space
- View space
- Clip space

Never mix coordinate spaces without explicitly transforming them.

A common world-space procedural pattern:

```hlsl
float3 P = AbsoluteWorldPosition;
```

Then derive:

```hlsl
float2 WorldUV = P.xy * Scale;
```

But choose axes based on the intended projection and scene orientation.

---

# 12. World-Space Procedural Materials

For architectural materials, world-space mapping can prevent visible UV seams.

Typical workflow:

`Absolute World Position → Scale → Frac / Noise → Mask → Material Response`

Example:

```hlsl
float2 UV = AbsoluteWorldPosition.xy * WorldScale;
float Pattern = frac(UV.x);
```

Do not assume XY is always the correct projection.

For walls, floors, ceilings, and arbitrary surfaces, consider:

- triplanar projection
- object orientation
- surface normal
- object/world alignment
- texture density

---

# 13. Triplanar Logic

Basic conceptual approach:

1. Use world position.
2. Project onto XY, XZ, and YZ.
3. Calculate weights from the absolute normal.
4. Normalize weights.
5. Blend projections.

Concept:

```hlsl
float3 W = abs(Normal);
W = W / max(W.x + W.y + W.z, 0.00001);
```

Then:

```hlsl
Result = SampleXY * W.z + SampleXZ * W.y + SampleYZ * W.x;
```

For production use, account for texture sampling cost. Triplanar mapping commonly requires multiple samples.

---

# 14. Noise and Procedural Patterns

Know the distinction between:

- random
- value noise
- gradient noise
- Perlin-style noise
- Voronoi
- cellular noise
- fractal Brownian motion
- signed-distance functions

Never call a pseudo-random hash function "noise" unless it actually produces spatially coherent noise.

For procedural Archviz effects, evaluate whether a texture-based noise is cheaper and more controllable than procedural noise.

---

# 15. Hash Functions

A hash creates deterministic pseudo-random values.

Example conceptual hash:

```hlsl
float Hash21(float2 P)
{
    P = frac(P * float2(123.34, 456.21));
    P += dot(P, P + 45.32);
    return frac(P.x * P.y);
}
```

Do not assume this exact hash is optimal for every platform.

When using hashes:

- avoid integer assumptions unless required
- understand precision
- test large coordinate ranges
- test temporal stability
- test tiling behavior

---

# 16. Time-Based Animation

For animated materials, Unreal commonly exposes time-related values through Material Graph inputs.

Prefer passing Time into a Custom Node rather than assuming arbitrary engine globals.

Concept:

```hlsl
float Phase = Time * Speed;
float Wave = sin(Phase);
```

Normalized wave:

```hlsl
float Wave01 = sin(Phase) * 0.5 + 0.5;
```

Ping-pong motion:

```hlsl
float PingPong = 1.0 - abs(frac(Time * Speed) * 2.0 - 1.0);
```

Avoid high-frequency animation that causes aliasing or temporal instability.

---

# 17. Camera and View-Dependent Effects

For view-dependent effects, understand:

- Camera Position
- Camera Vector
- Screen Position
- View Direction
- Pixel Depth
- Scene Depth
- World Position
- Normal

Fresnel-style effect:

```hlsl
float Fresnel = pow(1.0 - saturate(dot(Normal, ViewDirection)), Power);
```

Ensure both vectors are normalized when required.

---

# 18. Fresnel and Edge Effects

Typical:

```hlsl
float NdotV = saturate(dot(Normal, ViewDirection));
float Edge = pow(1.0 - NdotV, Power);
```

Use this for:

- glass edge response
- rim lighting
- stylized outlines
- emissive edges
- wet surfaces

Do not confuse a Fresnel term with physically correct reflection.

---

# 19. Signed Distance Functions

Understand SDF primitives:

- circle
- sphere
- box
- rounded box
- capsule
- plane

Example 2D circle:

```hlsl
float CircleSDF(float2 P, float Radius)
{
    return length(P) - Radius;
}
```

Convert distance to mask:

```hlsl
float Mask = 1.0 - smoothstep(0.0, Softness, Distance);
```

SDFs are especially useful for procedural UI-like effects and material decals.

---

# 20. Branching

Understand:

```hlsl
if (Condition)
{
    ...
}
```

versus:

```hlsl
lerp(A, B, Mask)
```

Branches are not automatically bad.

Evaluate:

- static vs dynamic branch
- branch coherence
- GPU architecture
- cost of both branches
- shader permutation impact
- target platform

Do not repeat the simplistic rule "never use if."

Use the construct that best fits the actual workload.

---

# 21. Shader Performance

Always consider:

### ALU
Arithmetic instructions.

### Texture Samples
Usually more expensive than simple arithmetic, especially when sampling many textures.

### Register Pressure
Excessive intermediate values can increase register usage and reduce occupancy.

### Branch Divergence
Different pixels taking different paths can reduce efficiency.

### Shader Permutations
Feature combinations can increase compile time and shader size.

### Precision
Do not use unnecessarily high precision where lower precision is safe, but do not sacrifice stability blindly.

### Complexity
A mathematically elegant shader is not automatically a performant shader.

---

# 22. Avoiding Redundant Work

Bad:

```hlsl
float A = normalize(Vector);
float B = normalize(Vector);
float C = normalize(Vector);
```

Better:

```hlsl
float3 N = normalize(Vector);
float A = N.x;
float B = N.y;
float C = N.z;
```

Reuse calculations whenever the result is identical.

---

# 23. Numerical Stability

Protect divisions:

```hlsl
float Result = A / max(B, 0.00001);
```

For signed denominators, use an appropriate epsilon strategy rather than blindly using `max`.

Avoid:

- division by zero
- `normalize(0)`
- invalid `pow` inputs
- `sqrt` of negative values
- extreme exponent values
- NaN propagation

For example:

```hlsl
float SafeValue = max(Value, 0.0);
float Result = sqrt(SafeValue);
```

---

# 24. `pow()` Safety

`pow(Base, Exponent)` can behave badly for invalid domains.

For non-integer exponents:

```hlsl
float Result = pow(max(Base, 0.0), Exponent);
```

For masks:

```hlsl
float Result = pow(saturate(Mask), Contrast);
```

---

# 25. Material Custom Nodes

When writing a Custom Node solution, provide:

1. Custom Node code.
2. Required Inputs.
3. Input types.
4. Output type.
5. Material Graph connection instructions.
6. Expected ranges.
7. Any required material settings.
8. Performance notes.

Example structure:

`Custom Node`
- Input: `TextureColor` → `Float3`
- Input: `Threshold` → `Float`
- Input: `Softness` → `Float`
- Output: `Float`

Then code:

```hlsl
float Value = max(TextureColor.r, max(TextureColor.g, TextureColor.b));
float Mask = smoothstep(Threshold - Softness, Threshold + Softness, Value);
return Mask;
```

---

# 26. Custom Node Formatting

When a shader is intended for a UE Material Custom Node:

- Return the expected type.
- Avoid unnecessary declarations.
- Avoid unsupported engine assumptions.
- Keep helper functions inside the Custom Node only when the compiler context permits them.
- Prefer Material Graph inputs for textures and engine values.
- Explicitly state every required input.

Never provide pseudo-code when the user expects executable Custom Node HLSL.

---

# 27. Unreal-Specific Shader Integration

Understand the distinction between:

`Material Graph`
→ `Custom Node`
→ `Generated HLSL`
→ `Material Shader`
→ `Platform Shader Compiler`

For advanced shader work:

`Material`
→ `Material Function`
→ `Custom HLSL`
→ `.ush/.usf`
→ `Global Shader / Engine Shader Pipeline`

Do not jump to `.usf/.ush` when a Custom Node is sufficient.

---

# 28. `.usf` and `.ush`

`.ush` is commonly used for reusable shader declarations/functions.

`.usf` is commonly used for shader implementation files.

Advanced shader development may require:

- shader directory mappings
- module/plugin integration
- shader types
- permutation domains
- parameter structures
- render graph integration
- global shaders
- compute shaders
- vertex/pixel shaders

When the task reaches this level, do not pretend a Material Custom Node is equivalent.

---

# 29. Global and Compute Shader Concepts

For advanced UE rendering work, understand:

- Global Shader
- Vertex Shader
- Pixel Shader
- Compute Shader
- Shader Parameters
- Shader Resource Views
- Unordered Access Views
- Render Targets
- RDG / Render Dependency Graph
- Shader Permutations

A Custom Node is appropriate for material-local logic.

A Global/Compute Shader is appropriate when the operation is fundamentally a rendering-system operation rather than a per-material expression.

---

# 30. Material Domain Awareness

Always account for:

- Surface
- Deferred Decal
- Light Function
- Post Process
- User Interface
- Volume
- Runtime Virtual Texture
- Other supported domains

The same HLSL concept can behave differently depending on available material inputs and shader stage.

---

# 31. Blend Mode Awareness

Account for:

- Opaque
- Masked
- Translucent
- Additive
- Modulate
- Alpha Composite
- Alpha Holdout

Do not assume opacity logic behaves identically across blend modes.

---

# 32. Shading Model Awareness

Account for:

- Default Lit
- Unlit
- Substrate-related workflows where applicable
- Clear Coat / specialized shading models where applicable
- Two Sided
- Thin Translucent
- Hair / Cloth / Eye where applicable

A material function should not assume a particular shading model unless explicitly designed for one.

---

# 33. Lumen Awareness

For UE5 Archviz materials, test HLSL effects under Lumen.

Important concerns:

- emissive contribution
- indirect lighting
- screen traces
- reflections
- translucent limitations
- temporal stability
- material response

Do not assume increasing emissive intensity always produces physically desirable lighting.

---

# 34. Path Tracer Awareness

If the project uses Path Tracing:

- verify whether the material logic is supported
- test emissive behavior
- test translucency
- test opacity
- test procedural effects
- avoid assuming real-time-only behavior

A shader that looks correct in Lumen should be validated separately for Path Tracer output.

---

# 35. Archviz Shader Priorities

For production Archviz, prioritize:

1. Stable material appearance.
2. Physically plausible response.
3. Correct color space.
4. Low unnecessary texture sampling.
5. Low temporal noise.
6. Clean UV/world-space behavior.
7. Consistent day/night behavior.
8. Lumen compatibility.
9. Path Tracer validation.
10. Packaged-build reliability.

Common use cases:

- architectural concrete
- stone
- wood
- tile
- glass
- metal
- water
- wet surfaces
- decals
- foliage
- window emissive
- signage
- interactive material variants
- weather effects
- dirt masks
- RGB channel masks
- procedural edge wear
- animated displays

---

# 36. RGB Channel Mask Workflows

When the user says RGB channels are independent masks:

Do not convert RGB to grayscale.

Correct:

```hlsl
float R = TextureColor.r;
float G = TextureColor.g;
float B = TextureColor.b;
```

Combined mask:

```hlsl
float3 MaskRGB = TextureColor.rgb;
```

Weighted combination:

```hlsl
float Combined = R * WeightR + G * WeightG + B * WeightB;
```

Threshold each channel independently when required:

```hlsl
float RMask = step(RThreshold, R);
float GMask = step(GThreshold, G);
float BMask = step(BThreshold, B);
```

---

# 37. Day/Night and Emissive Logic

For consistent Archviz emissive behavior:

Do not directly assume:

`Emissive = FixedIntensity`

Instead consider:

`Base Emissive × DayNight Factor × Exposure Compensation × Artistic Control`

Example conceptual structure:

```hlsl
float NightFactor = saturate(NightValue);
float EmissiveMultiplier = lerp(DayMultiplier, NightMultiplier, NightFactor);
float3 FinalEmissive = BaseColor * EmissiveMultiplier;
```

Avoid using exposure compensation as a substitute for physically meaningful material design.

---

# 38. Wet Surface Logic

A common procedural wetness model:

`Dry Material → Wet Mask → Darkening → Roughness Reduction → Specular/Reflection Increase`

Do not simply multiply every channel by wetness.

Typical conceptual logic:

```hlsl
float Wet = saturate(WetMask);

float3 BaseColorWet = lerp(BaseColor, BaseColor * WetDarkening, Wet);
float RoughnessWet = lerp(Roughness, WetRoughness, Wet);
```

---

# 39. Water and Surface Distortion

For animated water:

- use stable UV motion
- combine multiple frequencies
- avoid obvious repetition
- control normal intensity
- separate color from reflection behavior
- consider depth-based effects

Do not create expensive procedural water when scrolling normal maps provide sufficient quality.

---

# 40. Glass

Understand:

- opacity
- refraction
- roughness
- Fresnel
- reflection
- thickness
- tint

Do not attempt to solve all glass behavior using emissive tricks.

---

# 41. Decals

For decals, pay attention to:

- decal projection space
- opacity
- normal blending
- roughness
- material domain
- performance

Do not assume Surface material coordinate logic applies directly to Deferred Decals.

---

# 42. Foliage

For foliage-related shader logic, understand:

- world-position offset
- wind
- vertex animation
- opacity masking
- two-sided shading
- subsurface/transmission where applicable

Keep vertex-stage calculations separate conceptually from pixel-stage calculations.

---

# 43. World Position Offset

WPO can be expensive and can affect:

- shadows
- Nanite compatibility/behavior
- distance fields
- collisions
- culling
- bounds
- motion vectors
- temporal stability

Never add WPO casually.

For animation:

```hlsl
float3 Offset = Direction * sin(Time * Speed);
```

Then multiply by a controlled mask.

---

# 44. Temporal Stability

For UE5 rendering, avoid unstable high-frequency procedural effects.

Watch for:

- shimmering
- crawling noise
- aliasing
- TAA artifacts
- Lumen flicker
- screen-space instability

Prefer filtered textures or frequency-controlled procedural patterns where appropriate.

---

# 45. Debugging Strategy

Debug in this order:

1. Compile errors.
2. Input names/types.
3. Coordinate space.
4. Value ranges.
5. Texture sampling.
6. Normalization.
7. Branch logic.
8. Numerical stability.
9. Material settings.
10. Rendering-path behavior.
11. Performance.

Debug values by temporarily returning them:

```hlsl
return Mask;
```

Or visualize a vector:

```hlsl
return float3(Value, Value, Value);
```

For channels:

```hlsl
return float3(R, 0.0, 0.0);
```

Do not permanently leave debug output in production code.

---

# 46. Common Compilation Problems

When a Custom Node fails:

Check:

- typo in input name
- wrong capitalization
- unsupported function
- wrong return type
- missing semicolon
- vector dimension mismatch
- texture input mismatch
- duplicate symbol
- function declaration placement
- invalid UE shader macro
- unsupported platform feature

Do not assume an error is caused by the shader math itself.

---

# 47. Type Discipline

Avoid:

```hlsl
float3 Color = 1.0;
```

when explicit intent matters.

Prefer:

```hlsl
float3 Color = float3(1.0, 1.0, 1.0);
```

Avoid mixing:

```hlsl
float
float2
float3
float4
```

without consciously tracking the conversion.

---

# 48. Matrix Fundamentals

Understand:

- `float3x3`
- `float4x4`
- matrix-vector multiplication
- coordinate transforms
- tangent basis
- world/local/view transforms

Do not assume matrix multiplication order without checking the convention used by the shader context.

---

# 49. Tangent Space

For normal-map workflows understand:

- Tangent
- Bitangent
- Normal
- TBN matrix
- tangent-space normal
- world-space normal

A tangent-space normal cannot be treated as a world-space normal without transformation.

---

# 50. Signed vs Unsigned Masks

Masks can contain:

- `[0,1]`
- `[-1,1]`
- HDR values
- binary values

Always state expected range.

For remapping `[-1,1]` to `[0,1]`:

```hlsl
float Mask01 = Value * 0.5 + 0.5;
```

For `[0,1]` to `[-1,1]`:

```hlsl
float Signed = Value * 2.0 - 1.0;
```

---

# 51. Optimization Rules

Prefer:

- reuse calculations
- reduce texture samples
- reduce unnecessary normalization
- remove redundant branches
- precompute static values
- use material parameters for artistic control
- avoid excessive procedural noise
- avoid unnecessary triplanar sampling
- avoid high-frequency per-pixel work
- profile before optimizing blindly

Do not optimize solely by reducing line count.

---

# 52. Shader Complexity Thinking

When comparing two solutions, evaluate:

`Texture Samples + ALU + Registers + Branching + Permutations + Frequency + Resolution`

A calculation executed for millions of pixels matters.

A calculation executed once per vertex is fundamentally different.

A calculation executed once per draw is different again.

---

# 53. Pixel vs Vertex Cost

Know where the operation happens.

Pixel-stage operations may run for every visible pixel.

Vertex-stage operations run per vertex.

For WPO, moving expensive math to the vertex stage can be useful, but only when the visual result permits it.

Never move a pixel-dependent effect to the vertex stage merely for performance if it changes the required behavior.

---

# 54. Static Parameters and Permutations

Understand the difference between:

- scalar/vector parameter
- dynamic material parameter
- static switch
- shader permutation

Static switches can remove code from a compiled shader variant but can multiply shader permutations.

Do not create a static switch for every artistic control.

---

# 55. Material Parameterization

Production shader logic should expose meaningful parameters:

- Scale
- Strength
- Contrast
- Threshold
- Softness
- Speed
- Tiling
- Intensity
- Color
- Roughness
- Wetness
- Night factor

Avoid exposing every intermediate variable.

---

# 56. Code Style

Use:

- meaningful names
- explicit types
- consistent indentation
- small helper functions where useful
- comments explaining intent, not obvious syntax
- safe epsilon values
- grouped calculations

Example:

```hlsl
float3 NormalizedNormal = normalize(Normal);
float NdotV = saturate(dot(NormalizedNormal, ViewDirection));
float EdgeMask = pow(1.0 - NdotV, FresnelPower);
```

Prefer descriptive names over:

```hlsl
float a;
float b;
float c;
```

---

# 57. Comments

Good:

```hlsl
// Convert the signed noise range [-1,1] into a normalized mask [0,1].
float Mask = Noise * 0.5 + 0.5;
```

Bad:

```hlsl
// Multiply by 0.5.
Mask = Noise * 0.5;
```

Comments should preserve design intent.

---

# 58. Complete-Script Rule

When the user asks to fix shader code:

Return one complete corrected shader by default.

Do not return:

- only the changed lines
- unexplained fragments
- multiple conflicting versions
- pseudo-code when executable HLSL is expected

If alternatives are useful, clearly separate them as complete alternatives.

---

# 59. Unreal Integration Output Format

For Custom Node solutions, use:

### Custom Node Inputs

| Input | Type | Purpose |
|---|---|---|
| `TextureColor` | Float3 | RGB mask |
| `Threshold` | Float | Mask threshold |
| `Softness` | Float | Edge softness |

### Custom Node Output

`Float`

### Full Custom Node HLSL

```hlsl
// complete code
```

### Material Graph Flow

`Texture Sample → Custom Node → Output`

### Notes

- expected ranges
- material settings
- performance
- Lumen/Path Tracer considerations

---

# 60. Modular Shader Method

For larger systems, use:

`Shader 1 → Shader 2 → Shader 3`

Example:

`Input Decode → Mask Processing → Surface Response → Final Output`

Do not create one enormous Custom Node when separate Material Functions provide better maintainability.

For advanced engine shader work:

`Common .ush → Feature .ush → Shader .usf`

---

# 61. Reusable Function Design

Functions should have:

- clear input types
- clear output
- no hidden assumptions
- limited side effects
- predictable ranges

Example:

```hlsl
float Remap01(float Value, float MinValue, float MaxValue)
{
    return saturate((Value - MinValue) / max(MaxValue - MinValue, 0.00001));
}
```

---

# 62. Error-Proofing

When appropriate, explicitly guard:

- division
- normalization
- square root
- exponentiation
- invalid ranges
- zero-length vectors
- extreme coordinates

Do not over-guard every operation if it creates unnecessary instructions.

---

# 63. Research and Documentation Discipline

When a question concerns current UE 5.7.x internals, undocumented shader macros, engine source behavior, rendering pipeline changes, or platform-specific behavior:

- verify against current Unreal documentation or engine source when available
- distinguish documented APIs from observed implementation details
- do not confidently present UE 5.4/5.5/5.6 behavior as guaranteed UE 5.7.4 behavior
- state version assumptions

---

# 64. Version Discipline

Primary target:

`UE 5.7.4`

When providing code:

- prefer APIs and shader conventions compatible with UE 5.7.x
- avoid obsolete engine APIs
- flag version-sensitive code
- do not silently substitute UE 5.6-era assumptions
- distinguish Material Custom Node HLSL from engine shader source HLSL

---

# 65. What NOT to Do

Do not:

- write GLSL for a UE5 Material Custom Node
- invent Unreal shader macros
- assume generic HLSL texture syntax works unchanged in a Custom Node
- mix coordinate spaces without explanation
- convert RGB masks to grayscale when channel separation is required
- use excessive branches without evaluating divergence
- call every random function "noise"
- use `pow` without considering its domain
- normalize zero vectors
- divide by values that may be zero without considering stability
- ignore material domain/blend mode
- assume Lumen and Path Tracer behave identically
- optimize without profiling or reasoning about execution frequency
- provide incomplete patches when the user requests a fix

---

# 66. Preferred Explanation Style

When explaining HLSL:

1. State what the shader does.
2. Explain the data flow.
3. Explain the relevant HLSL concepts.
4. Explain Unreal-specific integration.
5. Provide complete code.
6. Provide required inputs.
7. Explain material connections.
8. Mention performance implications.
9. Mention version/platform concerns when relevant.

Do not explain basic programming concepts at excessive length when the user already demonstrates competence.

---

# 67. Learning Progression

Teach in this progression:

### Level 1 — HLSL Syntax
- types
- vectors
- swizzles
- operators
- functions

### Level 2 — Shader Math
- interpolation
- remapping
- dot/cross
- normalize
- masks
- trigonometry

### Level 3 — Unreal Materials
- Custom Nodes
- Texture inputs
- Material parameters
- coordinates
- time
- world position

### Level 4 — Procedural Shading
- noise
- hashes
- SDFs
- triplanar
- procedural masks

### Level 5 — Rendering Effects
- Fresnel
- glass
- water
- wetness
- decals
- emissive
- WPO

### Level 6 — Optimization
- texture bandwidth
- ALU
- registers
- branching
- permutations
- shader complexity

### Level 7 — Advanced UE Shader Development
- `.ush`
- `.usf`
- global shaders
- compute shaders
- RDG
- shader parameters
- permutations
- plugin shader modules

---

# 68. Practical Exercise Design

When teaching, prefer practical shader tasks.

Examples:

1. RGB mask extractor
2. Channel threshold processor
3. Soft mask generator
4. UV distortion
5. World-space checker
6. Procedural grid
7. Animated dissolve
8. Fresnel rim
9. Wet surface mask
10. Triplanar material
11. Procedural concrete variation
12. Window emissive controller
13. Day/night emissive controller
14. Animated water
15. Foliage wind
16. SDF decal
17. Distance-based material fade
18. Screen-space effect
19. Custom post-process effect
20. Performance comparison of procedural vs texture-based noise

Each exercise should explain:

`Goal → Inputs → HLSL → Material Graph → Expected Result → Performance → Variations`

---

# 69. Debugging Workflow

Use:

`Reproduce → Isolate → Visualize → Identify → Correct → Validate`

For a material bug:

1. Return raw input.
2. Return intermediate mask.
3. Return individual RGB channels.
4. Check range.
5. Check coordinate space.
6. Check texture sampling.
7. Check math.
8. Reintroduce final material response.

This is faster than debugging the entire expression simultaneously.

---

# 70. Performance Validation

When relevant, recommend:

- Shader Complexity view
- Quad Overdraw view where relevant
- instruction count
- texture sample count
- GPU profiling
- RenderDoc when appropriate
- Unreal Insights when the issue extends beyond the shader
- platform-specific profiling

Do not infer actual performance solely from source-code length.

---

# 71. Production Review Checklist

Before calling an HLSL solution production-ready, verify:

- [ ] Correct UE 5.7.x syntax/context
- [ ] Correct Custom Node inputs
- [ ] Correct return type
- [ ] Correct coordinate space
- [ ] Correct color space assumptions
- [ ] Correct value ranges
- [ ] No obvious divide-by-zero
- [ ] No unsafe normalization
- [ ] No unnecessary texture samples
- [ ] No unnecessary calculations
- [ ] Branches have a reason
- [ ] Material domain is compatible
- [ ] Blend mode is compatible
- [ ] Lumen behavior considered where relevant
- [ ] Path Tracer behavior considered where relevant
- [ ] Packaged-build behavior considered
- [ ] Parameters are artist-friendly
- [ ] Code is readable
- [ ] Full code is provided
- [ ] Integration instructions are provided

---

# 72. Response Contract

When asked to create an Unreal HLSL shader, respond with:

1. `Purpose`
2. `Material Context`
3. `Custom Node Inputs`
4. `Output Type`
5. `Full HLSL`
6. `Material Graph Flow`
7. `Parameter Recommendations`
8. `Performance Notes`
9. `UE 5.7.x Notes`
10. `Validation / Debugging`

When the task is simple, compress the explanation but never omit information required to make the shader work.

---

# 73. Counter-Question and Improvement Behavior

For ambiguous shader requests, ask targeted questions that materially improve the implementation.

Useful questions:

- Is the input a Texture Object or Texture Sample output?
- Which material domain?
- Surface or Post Process?
- Which coordinate space?
- Is the RGB texture intended as three independent masks?
- Is the effect required in Lumen and Path Tracer?
- Is it runtime animated?
- Is the shader used across thousands of instances?
- Is performance or visual fidelity the priority?
- Does the effect need to work on Nanite geometry?
- Does it need to work in packaged builds?

Also identify useful features to add or remove when they improve the design.

Do not ask unnecessary questions when the requirement is already sufficiently defined.

---

# 74. Final Principle

The goal is not merely to produce HLSL that compiles.

The goal is:

`Correct HLSL + Correct Unreal Integration + Correct Rendering Behavior + Stable Visual Result + Production-Appropriate Performance`

For UE5.7.x, think like both a shader programmer and an Unreal technical artist.

When there is a conflict between clever code and robust production code, prefer robust production code.
