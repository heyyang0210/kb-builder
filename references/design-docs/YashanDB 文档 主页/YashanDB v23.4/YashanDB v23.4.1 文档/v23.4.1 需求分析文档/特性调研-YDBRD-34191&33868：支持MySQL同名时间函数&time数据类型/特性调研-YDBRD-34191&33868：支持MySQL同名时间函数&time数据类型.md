*IR链接：*  [YASHAN-3122](https://pingcode.yasdb.com/ship/ideas/66c5b23b4283cf23d4f37342?)     [YASHAN-3037](https://pingcode.yasdb.com/ship/ideas/66aaf8845808037af12604bd?)  

*SR链接：*  [YDBRD-34191 ](https://pingcode.yasdb.com/pjm/items/670de9bce489dd0868f7a15b?)    [YDBRD-33868](https://pingcode.yasdb.com/pjm/items/6707b00de489dd0868f43aef?)  

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

支持MySQL中TIME、TIMEDIFF、TIMESTAMP、TIMESTAMPDIFF函数 & time数据类型。

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

###   [2.1 SQL语法](#21-sql语法)  

```
-- 时间函数
select TIME(expr);

select TIMEDIFF(expr1, expr2);

select TIMESTAMP(expr);
select TIMESTAMP(expr1, expr2);

select TIMESTAMPDIFF(unit, datetime_expr1, datetime_expr2);

-- time数据类型
craete table t1(f1 time(6));
select cast(123.456 as time(6));
```

###   [2.2 语句功能](#22-语句功能)  

|函数|功能|返回值类型|返回值类型范围|参数类型|
|---|---|---|---|---|
|TIME(expr)|提取表达式中时间部分|time|HHH:MM:SS,[-838:59:59,  838:59:59]，精度最大为6（第7位四舍五入）|expr需可转为time|
|TIMEDIFF(expr1, expr2)|返回time类型的expr1-expr2|time|同上|expr1、expr2需可转为time|
|TIMESTAMP(expr)|返回datetime类型的expr|datetime|YYYY-MM-DD HH:MM:SS,[0000-01-01 00:00:00, 9999-12-31 23:59:59]，精度最大为6（第7位四舍五入），month、day对应|expr需可转为datetime|
|TIMESTAMP(expr1, expr2)|返回datetime类型的expr1+expr2|datetime|同上|expr1需可转为datetime，expr2需可转为time|
|TIMESTAMPDIFF(unit, expr1, expr2)|返回expr2-expr1|bigint|/|expr1、expr2需可转为datetime|


###   [2.3 调研结论](#23-调研结论)  

- 优先校验expr1合法性，NULL是合法参数
- 若存在参数为NULL，若expr1合法，直接返回NULL
- 可转为time的类型：  
日期时间型（mysql:date/datetime/timestamp/time/year）+整型(tiny/small/int/big)+浮点型(float/double)+字符串型(char/varchar)+bool；
参数若为数字型：整数位数≤7（1234567），可为负数；
- ![WXWorkLocalPro_17328513735437.png](https://pingcode.yasdb.com/atlas/files/public/674936bda1ad9a3311de3a05/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBZ0VBQUFnQUFBQUFBRUFJRndFQUFBQUFSRUFBQUlBQUNBQUlCQUFBQUFnQUVBQVFBQUlBQUFFZ0FBRUFDQUFBQUFBQUFBQUFBQUJnQUFBZ0FBQUFDQUFBQUFBQUFBQUFCRkFJQ0FBQVFCQUFBQkFBQUFBQkFBQUFBQWdBQUFBQUFBQUFCQUFBQUFBQUFBQUFRQWdNQUFBSUFFQUFBQUFDQUFBZ29BPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU5OTQsImV4cCI6MTc4MjQ2Njc5NH0.bOoX5mIJsZEfw3W4AboW45l0VEczYimeQEC_Lwo5tJ0)
-   
至多存在6位小数，对第7位做四舍五入；当整数部分为极值时小数超6位提示NULL；
- ![WXWorkLocalPro_17328610473903.png](https://pingcode.yasdb.com/atlas/files/public/67495c85a1ad9a3311de3a42/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBZ0VBQUFnQUFBQUFBRUFJRndFQUFBQUFSRUFBQUlBQUNBQUlCQUFBQUFnQUVBQVFBQUlBQUFFZ0FBRUFDQUFBQUFBQUFBQUFBQUJnQUFBZ0FBQUFDQUFBQUFBQUFBQUFCRkFJQ0FBQVFCQUFBQkFBQUFBQkFBQUFBQWdBQUFBQUFBQUFCQUFBQUFBQUFBQUFRQWdNQUFBSUFFQUFBQUFDQUFBZ29BPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU5OTQsImV4cCI6MTc4MjQ2Njc5NH0.bOoX5mIJsZEfw3W4AboW45l0VEczYimeQEC_Lwo5tJ0)
- ![WXWorkLocalPro_17328510794828.png](https://pingcode.yasdb.com/atlas/files/public/6749358fa1ad9a3311de3a00/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBZ0VBQUFnQUFBQUFBRUFJRndFQUFBQUFSRUFBQUlBQUNBQUlCQUFBQUFnQUVBQVFBQUlBQUFFZ0FBRUFDQUFBQUFBQUFBQUFBQUJnQUFBZ0FBQUFDQUFBQUFBQUFBQUFCRkFJQ0FBQVFCQUFBQkFBQUFBQkFBQUFBQWdBQUFBQUFBQUFCQUFBQUFBQUFBQUFRQWdNQUFBSUFFQUFBQUFDQUFBZ29BPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU5OTQsImV4cCI6MTc4MjQ2Njc5NH0.bOoX5mIJsZEfw3W4AboW45l0VEczYimeQEC_Lwo5tJ0)
-   
参数若为字符串型：若参数可转换为数字，等价于参数为数字型；
- ![WXWorkLocalPro_17328514932392.png](https://pingcode.yasdb.com/atlas/files/public/6749372da1ad9a3311de3a06/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBZ0VBQUFnQUFBQUFBRUFJRndFQUFBQUFSRUFBQUlBQUNBQUlCQUFBQUFnQUVBQVFBQUlBQUFFZ0FBRUFDQUFBQUFBQUFBQUFBQUJnQUFBZ0FBQUFDQUFBQUFBQUFBQUFCRkFJQ0FBQVFCQUFBQkFBQUFBQkFBQUFBQWdBQUFBQUFBQUFCQUFBQUFBQUFBQUFRQWdNQUFBSUFFQUFBQUFDQUFBZ29BPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU5OTQsImV4cCI6MTc4MjQ2Njc5NH0.bOoX5mIJsZEfw3W4AboW45l0VEczYimeQEC_Lwo5tJ0)


![WXWorkLocalPro_17328610473903.png](https://pingcode.yasdb.com/atlas/files/public/67495c85a1ad9a3311de3a43/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBZ0VBQUFnQUFBQUFBRUFJRndFQUFBQUFSRUFBQUlBQUNBQUlCQUFBQUFnQUVBQVFBQUlBQUFFZ0FBRUFDQUFBQUFBQUFBQUFBQUJnQUFBZ0FBQUFDQUFBQUFBQUFBQUFCRkFJQ0FBQVFCQUFBQkFBQUFBQkFBQUFBQWdBQUFBQUFBQUFCQUFBQUFBQUFBQUFRQWdNQUFBSUFFQUFBQUFDQUFBZ29BPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU5OTQsImV4cCI6MTc4MjQ2Njc5NH0.bOoX5mIJsZEfw3W4AboW45l0VEczYimeQEC_Lwo5tJ0)

![WXWorkLocalPro_17328505932996.png](https://pingcode.yasdb.com/atlas/files/public/674933daa1ad9a3311de39f9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBZ0VBQUFnQUFBQUFBRUFJRndFQUFBQUFSRUFBQUlBQUNBQUlCQUFBQUFnQUVBQVFBQUlBQUFFZ0FBRUFDQUFBQUFBQUFBQUFBQUJnQUFBZ0FBQUFDQUFBQUFBQUFBQUFCRkFJQ0FBQVFCQUFBQkFBQUFBQkFBQUFBQWdBQUFBQUFBQUFCQUFBQUFBQUFBQUFRQWdNQUFBSUFFQUFBQUFDQUFBZ29BPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU5OTQsImV4cCI6MTc4MjQ2Njc5NH0.bOoX5mIJsZEfw3W4AboW45l0VEczYimeQEC_Lwo5tJ0)



参数若为字符串型：若参数可转换为数字，等价于参数为数字型；

![WXWorkLocalPro_17328516134605.png](https://pingcode.yasdb.com/atlas/files/public/674937bba1ad9a3311de3a07/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBZ0VBQUFnQUFBQUFBRUFJRndFQUFBQUFSRUFBQUlBQUNBQUlCQUFBQUFnQUVBQVFBQUlBQUFFZ0FBRUFDQUFBQUFBQUFBQUFBQUJnQUFBZ0FBQUFDQUFBQUFBQUFBQUFCRkFJQ0FBQVFCQUFBQkFBQUFBQkFBQUFBQWdBQUFBQUFBQUFCQUFBQUFBQUFBQUFRQWdNQUFBSUFFQUFBQUFDQUFBZ29BPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU5OTQsImV4cCI6MTc4MjQ2Njc5NH0.bOoX5mIJsZEfw3W4AboW45l0VEczYimeQEC_Lwo5tJ0)



- TIMESTAMPDIFF中unit：MICROSECOND (microseconds), SECOND, MINUTE, HOUR, DAY, WEEK, MONTH, QUARTER, or YEAR；
- time数据类型精度为 [0, 6]，建表时精度默认为0；
- ![WXWorkLocalPro_17333025821727.png](https://pingcode.yasdb.com/atlas/files/public/67501940a1ad9a3311de4019/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBZ0VBQUFnQUFBQUFBRUFJRndFQUFBQUFSRUFBQUlBQUNBQUlCQUFBQUFnQUVBQVFBQUlBQUFFZ0FBRUFDQUFBQUFBQUFBQUFBQUJnQUFBZ0FBQUFDQUFBQUFBQUFBQUFCRkFJQ0FBQVFCQUFBQkFBQUFBQkFBQUFBQWdBQUFBQUFBQUFCQUFBQUFBQUFBQUFRQWdNQUFBSUFFQUFBQUFDQUFBZ29BPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU5OTQsImV4cCI6MTc4MjQ2Njc5NH0.bOoX5mIJsZEfw3W4AboW45l0VEczYimeQEC_Lwo5tJ0)
- 
- time数据类型运算


|返回值类型|运算|tinyint|smallint|int|bigint|float|double|char|varchar|decimal(3,2)|date|timestamp|time|time(1)|time(2)|time(3)|time(4)|time(5)|time(6)|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|time|+|int|int|bigint|bigint|double|double|double|double|decimal(10,2)|int|bigint|int|decimal(9,1)|decimal(10,2)|decimal(11,3)|decimal(12,4)|decimal(13,5)|decimal(14,6)|
||-|int|int|bigint|bigint|double|double|double|double|decimal(10,2)|int|bigint|int|decimal(9,1)|decimal(10,2)|decimal(11,3)|decimal(12,4)|decimal(13,5)|decimal(14,6)|
||*|int|bigint|bigint|bigint|double|double|double|double|decimal(10,2)|bigint|bigint|bigint|decimal(15,1)|decimal(16,2)|decimal(17,3)|decimal(18,4)|decimal(19,5)|decimal(20,6)|
||time/TYPEs|decimal(11,4)|decimal(11,4)|decimal(11,4)|decimal(11,4)|double|double|double|double|decimal(13,4)|decimal(11,4)|decimal(11,4)|decimal(11,4)|decimal(12,4)|decimal(13,4)|decimal(14,4)|decimal(15,4)|decimal(16,4)|decimal(17,4)|
||TYPEs/time|decimal(7, 4)|decimal(9, 4)|decimal(14, 4)|decimal(23, 4)|double|double|double|double|decimal(7,6)|decimal(12,4)|decimal(18,4)|decimal(11, 4)|decimal(12,5)|decimal(13,6)|decimal(14,7)|decimal(15,8)|decimal(16,9)|decimal(17,10)|
||time%TYPEs,TYPEs%time|int|int|int|bigint|double|double|double|double|decimal(7,2)|int|bigint|int|decimal(8,1)|decimal(9,2)|decimal(10,3)|decimal(11,4)|decimal(12,5)|decimal(13,6)|
|time(1)|+|decimal(9,1)|decimal(9,1)|decimal(12,1)|decimal(12,1)|double|double|double|double|||||||||||
||-|decimal(9,1)|decimal(9,1)|decimal(12,1)|decimal(21,1)|double|double|double|double|||||||||||
||*|decimal(11,1)|decimal(13,1)|decimal(18,1)|decimal(27,1)|double|double|double|double|||||||||||
||time/TYPEs|decimal(12,5)|decimal(12,5)|decimal(12,5)|decimal(12,5)|double|double|double|double|||||||||||
||TYPEs/time|decimal(8,4)|decimal(10,4)|decimal(15,4)|decimal(24,4)|double|double|double|double|||||||||||
||time%TYPEs,TYPEs%time|decimal(8,1)|decimal(8,1)|decimal(10,1)|decimal(19,1)|double|double|double|double|||||||||||




- 运算过程：将time转换为bigint后，进行运算


![WXWorkLocalPro_17333074841539.png](https://pingcode.yasdb.com/atlas/files/public/67502c67a1ad9a3311de4054/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBZ0VBQUFnQUFBQUFBRUFJRndFQUFBQUFSRUFBQUlBQUNBQUlCQUFBQUFnQUVBQVFBQUlBQUFFZ0FBRUFDQUFBQUFBQUFBQUFBQUJnQUFBZ0FBQUFDQUFBQUFBQUFBQUFCRkFJQ0FBQVFCQUFBQkFBQUFBQkFBQUFBQWdBQUFBQUFBQUFCQUFBQUFBQUFBQUFRQWdNQUFBSUFFQUFBQUFDQUFBZ29BPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU5OTQsImV4cCI6MTc4MjQ2Njc5NH0.bOoX5mIJsZEfw3W4AboW45l0VEczYimeQEC_Lwo5tJ0)

string类型参数若能转换为double，则转换同上；text中支持分隔符为':'、'\'

![WXWorkLocalPro_17337275207036.png](https://pingcode.yasdb.com/atlas/files/public/6756952ca1ad9a3311de446a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBZ0VBQUFnQUFBQUFBRUFJRndFQUFBQUFSRUFBQUlBQUNBQUlCQUFBQUFnQUVBQVFBQUlBQUFFZ0FBRUFDQUFBQUFBQUFBQUFBQUJnQUFBZ0FBQUFDQUFBQUFBQUFBQUFCRkFJQ0FBQVFCQUFBQkFBQUFBQkFBQUFBQWdBQUFBQUFBQUFCQUFBQUFBQUFBQUFRQWdNQUFBSUFFQUFBQUFDQUFBZ29BPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU5OTQsImV4cCI6MTc4MjQ2Njc5NH0.bOoX5mIJsZEfw3W4AboW45l0VEczYimeQEC_Lwo5tJ0)



##   [3. 规格与约束](#3-规格与约束)  

相比MySQL，

- TIME函数，当前yashan不支持参数类型：整型(tiny/small/int/big)+浮点型(float/double)(+bool)；
- TIMESTAMP函数，当前yashan不支持参数类型：整型(tiny/small/int/big)+浮点型(float/double)；


##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。

##   [5. 用例](#5-用例)  

```
--同名时间函数
SELECT TIME('2003-12-31 01:02:03');
SELECT TIME('2003-12-31 01:02:03.000123');

SELECT TIMEDIFF('2000:01:01 00:00:00','2000:01:01 00:00:00.000001');
SELECT TIMEDIFF('2008-12-31 23:59:59.000001','2008-12-30 01:01:01.000002');

SELECT TIMESTAMP('2003-12-31');
SELECT TIMESTAMP('2003-12-31 12:00:00','12:00:00');

SELECT TIMESTAMPDIFF(MONTH,'2003-02-01','2003-05-01');
SELECT TIMESTAMPDIFF(YEAR,'2002-05-01','2001-01-01');
SELECT TIMESTAMPDIFF(MINUTE,'2003-02-01','2003-05-01 12:05:55');

-- time数据类型
create table t1 (f1 time(1));
select cast(123.88888 as time(3));
select cast(123.88 as time(3));

```



  
