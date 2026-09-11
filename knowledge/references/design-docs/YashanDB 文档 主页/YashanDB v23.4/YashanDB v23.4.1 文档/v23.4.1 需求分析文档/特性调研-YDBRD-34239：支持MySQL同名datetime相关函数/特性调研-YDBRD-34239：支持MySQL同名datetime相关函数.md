*IR链接：*  [YASHAN-3122](https://pingcode.yasdb.com/ship/ideas/66c5b23b4283cf23d4f37342?)  

*SR链接：*  [YDBRD-34239](https://pingcode.yasdb.com/pjm/items/670e3846e489dd0868f7e06b?)  

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

支持MySQL中CURRENT_TIMESTAMP、LOCALTIME、LOCALTIMESTAMP、NOW、SYSDATE、UTC_TIMESTAMP函数。

##   [2. 接口](#2-接口)  

###   [2.1 SQL语法](#21-sql语法)  

```
-- 时间函数
select NOW(), NOW()+0;
select NOW(3),NOW(3)+0;
select NOW(), SLEEP(5),NOW()+0;

select SYSDATE(), SYSDATE()+0;
select SYSDATE(3),SYSDATE(3)+0;
select SYSDATE(3),SLEEP(5),SYSDATE(3)+0;

select UTC_TIMESTAMP, UTC_TIMESTAMP(), UTC_TIMESTAMP()+0;
select UTC_TIMESTAMP, UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)+0;
select UTC_TIMESTAMP(3),SLEEP(5),UTC_TIMESTAMP(3)+0;
```

###   [2.2 语句功能](#22-语句功能)  

|函数|功能|返回值类型|返回值类型范围|参数类型|
|---|---|---|---|---|
|CURRENT_TIMESTAMP([fsp]),CURRENT_TIMESTAMP,LOCALTIME([fsp]),LOCALTIME,LOCALTIMESTAMP([fsp]),LOCALTIMESTAMP|NOW()的同义词|/|/|/|
|NOW([fsp])|返回语句开始执行的时间|datetime|format：'YYYY-MM-DD hh:mm:ss'|可选参数fsp表示返回值小数部分长度，为[0, 6]，默认为0|
|SYSDATE([fsp])|返回函数执行的时间|同上|同上|同上|
|UTC_TIMESTAMP([fsp]),UTC_TIMESTAMP|返回语句开始执行时的UTC时间|同上|同上|同上|


###   [2.3 调研结论](#23-调研结论)  

- NOW()、UTC_TIMESTAMP()返回语句开始执行时的时间，SYSDATE()返回执行该函数的时间；


![WXWorkLocalPro_173468353242.png](https://pingcode.yasdb.com/atlas/files/public/67652bafa1ad9a3311de52dd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFRQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQWdBQUFBQUNBQUFBQUFBQUFBQUFnQUFBQ0FBQUFBQUFBQUFBQVFRQUFBQUFRSUFBQUFnQUFBUUFBQUFBQUFBQUFCQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFJQUFJQUFBQUFBQUFBQUFBQUFBQUFBSWtnUUFBQUFBQUFBQUFBQUFBQkJBQkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYxMjAsImV4cCI6MTc4MjQ2NjkyMH0.iDCJIqSmMaMLEhywbozA8FFlny3zQ5BlaeqDWv-f_0o)



- 函数返回值均为datetime，format为’YYYY-MM-DD hh:mm:ss.ff‘；
- NOW()、SYSDATE()仅为函数，其它函数可作为同名操作符；
- ![WXWorkLocalPro_17351195396501.png](https://pingcode.yasdb.com/atlas/files/public/676bd2c2a1ad9a3311de5794/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFRQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQWdBQUFBQUNBQUFBQUFBQUFBQUFnQUFBQ0FBQUFBQUFBQUFBQVFRQUFBQUFRSUFBQUFnQUFBUUFBQUFBQUFBQUFCQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFJQUFJQUFBQUFBQUFBQUFBQUFBQUFBSWtnUUFBQUFBQUFBQUFBQUFBQkJBQkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYxMjAsImV4cCI6MTc4MjQ2NjkyMH0.iDCJIqSmMaMLEhywbozA8FFlny3zQ5BlaeqDWv-f_0o)




- 参数fsp指定显示的小数位数，不做四舍五入处理；
- ![WXWorkLocalPro_17351802906963.png](https://pingcode.yasdb.com/atlas/files/public/676cc01ea1ad9a3311de57d9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFRQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQWdBQUFBQUNBQUFBQUFBQUFBQUFnQUFBQ0FBQUFBQUFBQUFBQVFRQUFBQUFRSUFBQUFnQUFBUUFBQUFBQUFBQUFCQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFJQUFJQUFBQUFBQUFBQUFBQUFBQUFBSWtnUUFBQUFBQUFBQUFBQUFBQkJBQkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYxMjAsImV4cCI6MTc4MjQ2NjkyMH0.iDCJIqSmMaMLEhywbozA8FFlny3zQ5BlaeqDWv-f_0o)
- 
- fsp为常量值，不可从表中获取；


![WXWorkLocalPro_17355246926335.png](https://pingcode.yasdb.com/atlas/files/public/67720163a1ad9a3311de5afb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFRQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQWdBQUFBQUNBQUFBQUFBQUFBQUFnQUFBQ0FBQUFBQUFBQUFBQVFRQUFBQUFRSUFBQUFnQUFBUUFBQUFBQUFBQUFCQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFJQUFJQUFBQUFBQUFBQUFBQUFBQUFBSWtnUUFBQUFBQUFBQUFBQUFBQkJBQkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYxMjAsImV4cCI6MTc4MjQ2NjkyMH0.iDCJIqSmMaMLEhywbozA8FFlny3zQ5BlaeqDWv-f_0o)



- NOW()总小于SYDATE()，因为NOW()是语句开始执行时间；  
NOW()与UTC_TIMESTAMP()区别仅为hour相差8，其余一致；
- ![WXWorkLocalPro_17355233658468.png](https://pingcode.yasdb.com/atlas/files/public/6771fc31a1ad9a3311de5ae8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFRQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQWdBQUFBQUNBQUFBQUFBQUFBQUFnQUFBQ0FBQUFBQUFBQUFBQVFRQUFBQUFRSUFBQUFnQUFBUUFBQUFBQUFBQUFCQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFJQUFJQUFBQUFBQUFBQUFBQUFBQUFBSWtnUUFBQUFBQUFBQUFBQUFBQkJBQkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYxMjAsImV4cCI6MTc4MjQ2NjkyMH0.iDCJIqSmMaMLEhywbozA8FFlny3zQ5BlaeqDWv-f_0o)




- 函数返回值类型datetime可参与四则运算，运算结果存在3种类型：
- bigint（YYYYMMDDhhmmss）  
double
- decimal


|返回值类型|运算|INT_TYPE|float,double|char,varchar|decimal(3,2)|date|timestamp|time|
|---|---|---|---|---|---|---|---|---|
|datetime|+|bigint|double|double|decimal(10,2)|int|bigint|int|
||-|bigint|double|double|decimal|int|bigint|int|
||*|bigint|double|double|decimal|bigint|bigint|bigint|
||datetime/TYPEs|decimal|double|double|decimal|decimal|decimal|decimal|
||TYPEs/datetime|decimal|double|double|decimal|decimal|decimal|decimal|
||datetime%TYPEs,TYPEs%datetime|bigint|double|double|decimal|int|bigint|int|
|datetime(1)|+|decimal|double|double|||||
||-|decimal|double|double|||||
||*|decimal|double|double|||||
||datetime/TYPEs|decimal|double|double|||||
||TYPEs/datetime|decimal|double|double|||||
||datetime%TYPEs,TYPEs%datetime|decimal|double|double|||||




##   [3. 规格与约束](#3-规格与约束)  

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。

##   [5. 用例](#5-用例)  

```

select now(6),sysdate(6),sleep(5),now(6),sysdate(6);

select now(1), now(2), now(3), now(4), now(5), now(6);

select sysdate(1), sysdate(2), sysdate(3), sysdate(4), sysdate(5), sysdate(6);

select utc_timestamp(1), utc_timestamp(2), utc_timestamp(3), utc_timestamp(4), utc_timestamp(5), utc_timestamp(6);

```



  
