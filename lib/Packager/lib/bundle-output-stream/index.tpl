<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta http-equiv="x-ua-compatible" content="ie=edge">
	<title>{{ "[DEVELOPMENT] " if devMode }}{{ title }}</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">
	{%- for stylesheet in stylesheets %}
	{%- if stylesheet.href %}
	<link rel="stylesheet" href="{{ stylesheet.href }}"/>
	{%- else %}
	<style>{{ stylesheet.contents }}</style>
	{% endif -%}
	{% endfor -%}
	{%- for script in scripts %}
	{%- if script.src %}
	<script src="{{ script.src }}"></script>
	{%- else %}
	<script>{{ script.contents }}</script>
	{% endif -%}
	{%- endfor %}
</head>
<body>
</body>
</html>