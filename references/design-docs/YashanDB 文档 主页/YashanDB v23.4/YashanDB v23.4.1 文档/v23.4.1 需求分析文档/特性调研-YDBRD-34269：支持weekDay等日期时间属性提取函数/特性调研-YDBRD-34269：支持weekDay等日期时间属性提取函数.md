*IR链接：*  [YASHAN-3046](https://pingcode.yasdb.com/ship/ideas/66b040355808037af1261faf?)  

*SR链接：*  [YDBRD-34269](https://pingcode.yasdb.com/pjm/items/670e470ce489dd0868f7f2f0?)  

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

支持MySQL中WEEK、QUARTER、DAYNAME等函数。

##   [2. 接口](#2-接口)  

###   [2.1 SQL语法](#21-sql语法)  

```
select week('2025-1-1');
```

###   [2.2 语句功能](#22-语句功能)  

|函数|功能|返回值类型|返回值值域|参数类型|
|---|---|---|---|---|
|WEEK(date),WEEK(date, mode)|返回date对应的周数|int|根据mode不同，为[0, 53]、[1, 53]|date=>timestamp，,mode=>decimal|
|QUARTER(date)|返回date对应的季度|int|[1, 4]|date=>timestamp|
|DAYNAME(date)|返回date对应平日的名称|varchar(9)|’Monday‘，,'Tuesday'...|date=>timestamp|
|MONTHNAME(date)|返回date对应月的全名|varchar(9)|'January',,'February'...|date=>timestamp|
|WEEKDAY(date)|返回date对应平日的索引|int|[0, 6],0=Monday，,1=Tuesday...|date=>timestamp|
|WEEKOFYEAR(date)|返回日历周的序号，兼容等价于WEEK(date, 3)|int|[1, 53]|date=>timestamp|
|YEARWEEK(date),YEARWEEK(date, mode)|返回date对应的年数和周数|int|[0000000, 999953]|date=>timestamp，,mode=>decimal|


###   [2.3 调研结论](#23-调研结论)  

主要工作量在WEEK()函数：

- mode值需可转为decimal，且该decimal的范围为 [-INT64_MAX-1, UINT64_MAX]；
- ![WXWorkLocalPro_17400348941674.png](https://pingcode.yasdb.com/atlas/files/public/67b6d370d6fcabebff225dd9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQVFBQUFBSUFBQUFBQVFBZ0FBQUFBQUFBQUFBQUFBQUFCQkFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQVFBQUFFQUFBQUFBRUFBQUJBQUFBQUFBQUFBUUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUVBQWdBQkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMzcsImV4cCI6MTc4MjQ2NzAzN30.QP41PuULpajzASe-hRfa8FaxS7tV0GG1dCSlCSyB_fU)
- ![WXWorkLocalPro_17400350672387.png](https://pingcode.yasdb.com/atlas/files/public/67b6d41f98ac295b69be10c5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQVFBQUFBSUFBQUFBQVFBZ0FBQUFBQUFBQUFBQUFBQUFCQkFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQVFBQUFFQUFBQUFBRUFBQUJBQUFBQUFBQUFBUUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUVBQWdBQkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMzcsImV4cCI6MTc4MjQ2NzAzN30.QP41PuULpajzASe-hRfa8FaxS7tV0GG1dCSlCSyB_fU)
- 
- mysql资料中描述mode参数值为以下8种情况：
- ![WXWorkLocalPro_17399617132930.png](https://pingcode.yasdb.com/atlas/files/public/67b5b57a98ac295b69be1057/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQVFBQUFBSUFBQUFBQVFBZ0FBQUFBQUFBQUFBQUFBQUFCQkFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQVFBQUFFQUFBQUFBRUFBQUJBQUFBQUFBQUFBUUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUVBQWdBQkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMzcsImV4cCI6MTc4MjQ2NzAzN30.QP41PuULpajzASe-hRfa8FaxS7tV0GG1dCSlCSyB_fU)
- 
- 从mode中提取bit：取低3位bit，若bit(0)为0，bit(2)^1，得到3位bit值；
- 根据提取的3位bit得到返回的周数：


|bit|2|1|0|
|---|---|---|---|
|true|第一周是包含"每周的第一天的"的周|range为[1, 53]，周数与给定年无关|周一是每周的第一天|
|false|周数符合ISO 8601:1988，包含1月1日且在新的一年里含有该周的4天及以上，该周为第一周，否则是上一年的最后一周，且该周的下一周是第一周|range为[0, 53]，周数与给定年相关|周日是每周的第一天|


- ![WXWorkLocalPro_17399642731116.png](https://pingcode.yasdb.com/atlas/files/public/67b5bf91d6fcabebff225d73/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQVFBQUFBSUFBQUFBQVFBZ0FBQUFBQUFBQUFBQUFBQUFCQkFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQVFBQUFFQUFBQUFBRUFBQUJBQUFBQUFBQUFBUUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUVBQWdBQkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMzcsImV4cCI6MTc4MjQ2NzAzN30.QP41PuULpajzASe-hRfa8FaxS7tV0GG1dCSlCSyB_fU)




- 对YEARWEEK函数，提取后的bit(1)恒为true


##   [3. 规格与约束](#3-规格与约束)  

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。

##   [5. 用例](#5-用例)  

```

select week('2025-1-1');

```



  
