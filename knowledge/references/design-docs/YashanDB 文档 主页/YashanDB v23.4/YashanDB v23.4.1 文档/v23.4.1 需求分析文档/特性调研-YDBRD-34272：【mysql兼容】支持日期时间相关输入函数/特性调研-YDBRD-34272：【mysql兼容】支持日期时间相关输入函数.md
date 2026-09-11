

SR链接：  [https://pingcode.yasdb.com/pjm/items/670e47c9e489dd0868f7f368?](https://pingcode.yasdb.com/pjm/items/670e47c9e489dd0868f7f368?)  

#YDBRD-34272 【mysql兼容】支持日期时间相关输入函数



#   [1. Overview（概述）](#1-overview概述)  

函数的语法、功能调研基于MYSQL 5.7。

友商文档：

  [https://dev.mysql.com/doc/refman/5.7/en/date-and-time-functions.html](https://dev.mysql.com/doc/refman/5.7/en/date-and-time-functions.html)  

#   [2. Features（功能特性）](#2-features功能特性)  

(1) 功能按等价类划分子特性，将每个子特性对应的输出行为，尝试进行行为解释说明。等价类划分要证明全面。

|功能|调研表现|
|---|---|
|FROM_UNIXTIME||
|SEC_TO_TIME||
|FROM_DAYS||
|STR_TO_DATE||


(2) 函数或者表达式特性调研，必须给出不同参数组合情况下，功能特性的表现情况。同时因为与数据类型相关，要组合不同数据类型入参下，计划和执行阶段出参的类型。

##   [2.1 FROM_UNIXTIME](#21-lcase)  

from_unixtime(unix_timetamp[, format])：

输入为unix_timestamp(an internal timestamp value)，表示从 '1970-01-01 00:00:00' UTC 开始的秒数；可以通过UNIX_TIMETAMP()函数生成。

1）1-2个入参

select from_unixtime(1447430881) from dual;

select from_unixtime(1447430881, '%Y %D %M %h:%i:%s %x') from dual;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b6cd1698ac295b69be10b4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



2）返回datatime或varchar

drop view if exists testV1;

create view testV1 as select from_unixtime(1447430881) from dual;

desc testV1;

drop view testV1;

create view testV1 as select from_unixtime(1447430881,  '%Y %D %M %h:%i:%s %x') from dual;

desc testV1;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b6cd6098ac295b69be10b5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



3）秒尾精度

若unix_timestamp是整数，则返回的datatime类型秒尾精度为0；

若unix_timestamp是number类型值，则返回的datatime类型秒尾精度与number值精度相同，最大为6位精度；

若unix_timestamp是浮点类型值，则返回的datatime类型秒尾精度为6位精度；

select from_unixtime(1447430881.987654321) from dual;

select from_unixtime(1447430881.012) from dual;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b6ce93d6fcabebff225dd0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



4）unix_timetamp类型为bigint类型，若计算结果超出范围，返回null

select from_unixtime(18446744073709551615) from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/67b6d02398ac295b69be10bd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)

虽然mysql返回的类型是datetime，但有效范围是timestamp类型的范围；范围是按照UTC时间界定，换算到本地时间则有相对偏移

select from_unixtime(-1) from dual;

select from_unixtime(0) from dual;

select from_unixtime(2147483647) from dual;

select from_unixtime(2147483648) from dual;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67c113266a1ae92ae373676b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



The DATETIME type is used for values that contain both date and time parts. 

MySQL retrieves and displays DATETIME values in 'YYYY-MM-DD hh:mm:ss' format. The supported range is '1000-01-01 00:00:00' to '9999-12-31 23:59:59'.



The TIMESTAMP data type is used for values that contain both date and time parts. TIMESTAMP has a range of '1970-01-01 00:00:01' UTC to '2038-01-19 03:14:07' UTC.



5）format指定时间日期格式，可以出现普通字符，若为空则返回null

select from_unixtime(1294967296, '%Y %D %M %h:%i:%s %x') from dual;

select from_unixtime(1294967296, 'abc') from dual;

select from_unixtime(1294967296, 'abc %M %x %D aaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbbbbbbbbbbb') from dual;

select from_unixtime(1294967297, 89911111111111111111111111111111111) from dual;

select from_unixtime(1294967297, '') from dual;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b6d147d6fcabebff225dd7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



6）任意参数为null，返回null

select from_unixtime(null, '%Y %D %M %h:%i:%s %x') from dual;

select from_unixtime(1294967297, null) from dual;

select from_unixtime(null) from dual;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b6d1d998ac295b69be10c4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)





##   [2.2 SEC_TO_TIME](#22-json-extract)  

格式：sec_to_time(seconds)

输入秒数，返回Time类型值。

1）入参seconds为bigint类型，或可转换为bigint类型的表达式；

select sec_to_time(2378) from dual;

select sec_to_time(-8) from dual;

select sec_to_time(-0) from dual;

select sec_to_time(0) from dual;

select sec_to_time(0.00) from dual;

select sec_to_time(0.000000000) from dual;

select sec_to_time('') from dual;       

select sec_to_time(' ') from dual;     

![image.png](https://pingcode.yasdb.com/atlas/files/public/67b6f6af98ac295b69be10f0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)

![image.png](https://pingcode.yasdb.com/atlas/files/public/67b6f6c298ac295b69be10f2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



若入参无法正确转换为bigint值，返回00:00:00.000000，并产生一条warning；

select sec_to_time('abc') from dual;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b6f83e98ac295b69be10f5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



2）若超出范围，返回最大或最小Time结果，并产生一条warning；

select sec_to_time(18446744073709551615) from dual;

select sec_to_time(-4294967296) from dual;

select sec_to_time(4294967296.9999999) from dual;

select sec_to_time(-4294967296.99999999) from dual;

select sec_to_time(4294967296.99) from dual;

show warnings;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b6f45d98ac295b69be10ee/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)

![image.png](https://pingcode.yasdb.com/atlas/files/public/67b6f4ba98ac295b69be10ef/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



3）输入null，返回null

select sec_to_time(null) from dual;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b6f8f8d6fcabebff225e0f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



##   [2.3 FROM_DAYS](#22-json-extract)  

格式：from_days(n)

输入为天数，输出为DATE类型值。

1）n表示天数，bigint类型；若超出范围，固定输出 0000-00-00；

select from_days(730669) from dual;

select from_days(-1) from dual;

select from_days(-10000000) from dual;  
select from_days(0) from dual;

select from_days(0000000000000000000000) from dual;

select from_days(18446744073709551615) from dual;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b7dae739823f2ac1f25e9e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)

![image.png](https://pingcode.yasdb.com/atlas/files/public/67b7db0139823f2ac1f25e9f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



The DATE type is used for values with a date part but no time part. MySQL retrieves and displays DATE values in 'YYYY-MM-DD' format. The supported range is '1000-01-01' to '9999-12-31'.



2）若入参表达式转换为Bigint类型结果非数值，产生一条warning，返回 0000-00-00

select from_days('') from dual;

select from_days(' ') from dual;

select from_days('abc') from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/67b7dbec39823f2ac1f25ea2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



3）输入null，返回null；

select from_days(null) from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/67b7dc3439823f2ac1f25ea3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



##   [2.4 STR_TO_DATE](#22-json-extract)  

格式：str_to_date(str, format)

输入字符串与时间日期格式字符串，输出DATETIME或DATE、TIME类型结果。

1）两个入参，str与format；str表示一个时间日期字符串，format为指定了对应格式的字符串；

select str_to_date('01,5,2013','%d,%m,%Y') from dual;

select str_to_date('May 1, 2013','%M %d,%Y') from dual;

 

![image.png](https://pingcode.yasdb.com/atlas/files/public/67b7e7386a1ae92ae3736411/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



2）若format为常量，根据forma中是否包含date、time部分，确定返回datetime、date或time类型；若format中不包含任何日期时间格式符号，返回date类型；

select str_to_date('01,5,2020 09:30:17 123456','%d,%m,%Y %h:%i:%s %f') from dual;

select str_to_date('01,5,2020','%d,%m,%Y') from dual;

select str_to_date('09:30:17 123456','%h:%i:%s %f') from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/67b7f21639823f2ac1f25eb6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



drop view if exists testV1;

create view testV1 as select str_to_date('01,5,2020 09:30:17 123456','%d,%m,%Y %h:%i:%s %f') from dual;

desc testV1;

drop view testV1;

create view testV1 as select str_to_date('01,5,2020','%d,%m,%Y') from dual;

desc testV1;

drop view testV1;

create view testV1 as select str_to_date('09:30:17 123456','%h:%i:%s %f') from dual;

desc testV1;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b7f2bc39823f2ac1f25eb7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



drop table if exists test123;

create table test123(c1 varchar(100));

insert into test123 values('01,5,2020');

insert into test123 values('09:30:17 123456');

insert into test123 values('01,5,2020 09:30:17 123456');

drop view if exists testV1;

create view testV1 as select str_to_date(c1, '%h:%i:%s %f') from test123;

desc testV1;

drop view if exists testV1;

create view testV1 as select str_to_date(c1, '%d,%m,%Y') from test123;

desc testV1;

drop view if exists testV1;

create view testV1 as select str_to_date(c1, '%d,%m,%Y %h:%i:%s %f') from test123;

desc testV1;

drop view testV1;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b81a7a6a1ae92ae3736427/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



drop table if exists test123;

create table test123(c1 varchar(100));

drop view if exists testV1;

create view testV1 as select str_to_date(c1, 'abc') from test123;

desc testV1;

drop view if exists testV1;

create view testV1 as select str_to_date('09:10:28', 'abc') from test123;

desc testV1;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b826e06a1ae92ae373644d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)





3）若format为变量，返回类型为datetime



drop table if exists test123;

create table test123(c1 varchar(100), c2 varchar(100));

insert into test123 values('01,5,2020', '%d,%m,%Y');

insert into test123 values('09:30:17 123456', '%h:%i:%s %f');

insert into test123 values('01,5,2020 09:30:17 123456', '%d,%m,%Y %h:%i:%s %f');



drop view if exists testV1;

create view testV1 as select str_to_date('01,5,2020', c2) from test123;

desc testV1;

drop view if exists testV1;

create view testV1 as select str_to_date(c1, c2) from test123;

desc testV1;

drop view testV1;

drop table test123;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b81c106a1ae92ae3736429/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)

![image.png](https://pingcode.yasdb.com/atlas/files/public/67b81c2d6a1ae92ae373642a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)

![image.png](https://pingcode.yasdb.com/atlas/files/public/67b81c476a1ae92ae373642b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



4）str中的字符必须对应format中的以%开头的格式字符或对应普通字符；若解析时无法对应则返回null并产生一条warning

select str_to_date('9','%m') from dual;

select str_to_date('abc','%m') from dual;

show warnings;

select str_to_date('abc 1','abc %m') from dual;

select str_to_date('abc 1 d','abc %m %d') from dual;

show warnings;

select str_to_date('abc 1 15','abc %m %d') from dual;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b8328439823f2ac1f25ee2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)

![image.png](https://pingcode.yasdb.com/atlas/files/public/67b832b939823f2ac1f25ee3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



5）函数逐个扫描每个字符，与format中额字符或格式匹配，若str结尾有多余字符，忽略多余字符并返回结果，同时产生一条warning

select str_to_date('09:30:17aaaaaaaaa','%h:%i:%s') from dual;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b8337139823f2ac1f25ee4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



6）若未指定时间日期某个部分，则置为0

select str_to_date('abc','abc') from dual;

select str_to_date('9','%m') from dual;

select str_to_date('9','%s') from dual;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b8339f39823f2ac1f25ee5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



7）若mysql配置NO_ZERO_DATE SQL mode，date部分若为0，str_to_date函数返回null并产生一条waring

SET sql_mode = 'NO_ZERO_DATE';

select str_to_date('9','%m') from dual;

SET sql_mode = '';

select str_to_date('9','%m') from dual;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b833e539823f2ac1f25ee6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)

![image.png](https://pingcode.yasdb.com/atlas/files/public/67b833fb39823f2ac1f25ee7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



8）mysql 5.7.44 版本之前不会进行整体的有效日期检查；5.7.44版本开始会检查，若非有效日期则返回null并产生一条warning

select str_to_date('23-2-31', '%y-%m-%d') from dual;

select str_to_date('2025-11-31', '%Y-%m-%d') from dual;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b8344639823f2ac1f25ee8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



8.0 mysql版本运行结果：

![clipbord_1740126365295.png](https://pingcode.yasdb.com/atlas/files/public/67b83c546a1ae92ae3736471/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



9）任意参数为null，返回null

select str_to_date(null, '%Y-%m-%d') from dual;

select str_to_date('2025-11-31',  null) from dual;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67b834a639823f2ac1f25ee9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



10）输入日期超出范围，不报错正常能够输出

select str_to_date('0009-1-1', '%Y-%m-%d') from dual;

select str_to_date('0999-12-31', '%Y-%m-%d') from dual;

select str_to_date('1000-1-1', '%Y-%m-%d') from dual;

select str_to_date('9999-12-31', '%Y-%m-%d') from dual;

select str_to_date('0009-1-1 09:30:18', '%Y-%m-%d %h:%i:%s') from dual;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67c159ef39823f2ac1f2625a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)

![image.png](https://pingcode.yasdb.com/atlas/files/public/67c15acf39823f2ac1f2625c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



creaet view testV1 as select str_to_date('0009-1-1 09:30:18', '%Y-%m-%d %h:%i:%s') from dual;

desc testV1;



![image.png](https://pingcode.yasdb.com/atlas/files/public/67c1627539823f2ac1f2626c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUXdDQUFBUUFJUklJQ0FBaERFSUlNZ0FFQWtBZ0dBeURBQ0NRQVFFRUVRQUtCQWhRQ0FDQWhLQ1VFb1VFQUlDQkVBRUFFSEFvSkFJQ1ZnQ1NvSWtVa2lDbUVBTVFBQkNBQWtCZ0FBS0NoTUdRQUFnQ0JBSWlnWkFBWUNCQUVDQU1NQUFJQUdBQUFBZ0FnQUFBSktnQUJBcUNFQUFnQUlBSVNBS2dBVUFBQUZRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyNzEsImV4cCI6MTc4MjQ2NzA3MX0.iKw4GmR1A5g7dDoXz7Wr1Fowzdm5CbmDBvEeTkvgycI)



##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

说明整个特性或子特性，在对应数据库下，调研得到的功能限制或约束。

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*