Created by 刘晓芳, last modified by  钟溱 on 八月 07, 2023

|序号|问题描述|问题语句|问题截图|是否必现|开发确认结果|
|---|---|---|---|---|---|
|1|select * from 包含nchar/nvarchar/nclob报错|create table test_sdv_ydbrd4263_tb_02 (c1 NCHAR(4000),c2 NVARCHAR(16000),c3 NCLOB);,insert into test_sdv_ydbrd4263_tb_02 values('中国中国中国中国中国','中国中国中国中国中国','中国中国中国中国中国');,commit;,select * from test_sdv_ydbrd4263_tb_02;|![](https://pingcode.yasdb.com/atlas/files/public/67396a01a1ad9a3311dc79fc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|national char rebase 32000没有处理超长逻辑，与内置函数中的问题32是一类问题，一同修复，不用提单。|
|2|查询DBA_TAB_COLS视图，nclob数据类型带了数据精度和刻度|create table test_sdv_ydbrd4263_tb_02 (c1 NCHAR(4000),c2 NVARCHAR(16000),c3 NCLOB);,insert into test_sdv_ydbrd4263_tb_02 values('中国中国中国中国中国','中国中国中国中国中国','中国中国中国中国中国');,commit;,select OWNER,TABLE_NAME,COLUMN_NAME,DATA_TYPE,DATA_LENGTH,DATA_PRECISION,DATA_SCALE,,NULLABLE,COLUMN_ID,DATA_DEFAULT,COLUMN_COMPRESSION from DBA_TAB_COLS where table_name like '%YDBRD4263_TB%',order by table_name;|![](https://pingcode.yasdb.com/atlas/files/public/67396a018970c2af4f51fb85/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk),![](https://pingcode.yasdb.com/atlas/files/public/67396a018970c2af4f51fb86/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|在建nclob列时，给precision和scale赋了值，处理逻辑有问题，提单跟踪。,  [YDBRD-16935](https://jira.yasdb.com/browse/YDBRD-16935?src=confmacro)    -  【nchar数据】建表包含nclob列，查询DBA_TAB_COLS视图，nclob数据类型带了数据精度和刻度  解决关闭|
|3|create table as select建表后，查询列视图，nclob列的data_length长度变成8000|create table test_sdv_ydbrd4263_tb_04 (nchar nchar,nvarchar nvarchar(1),nclob nclob);,insert into test_sdv_ydbrd4263_tb_04 values('中','中','中');,commit;,create table nchar as select * from test_sdv_ydbrd4263_tb_04;,select OWNER,TABLE_NAME,COLUMN_NAME,DATA_TYPE,DATA_LENGTH,DATA_PRECISION,DATA_SCALE,NULLABLE,COLUMN_ID,DATA_DEFAULT,COLUMN_COMPRESSION from DBA_TAB_COLS where table_name in ('NCHAR','NVARCHAR','NCLOB'),order by table_name;,  
|![](https://pingcode.yasdb.com/atlas/files/public/67396a01a1ad9a3311dc79fd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|原因同2，同一问题单修复。|
|4|nvarchar数据类型，插入超长度数据，报错不明确|SQL> create table test99 (c1 nvarchar(2000));,Succeed.,SQL> ️️insert into test99 values (lpad('©️',2050,'©️'));,YAS-04008 C1 size exceeding limit 4000,  
|![](https://pingcode.yasdb.com/atlas/files/public/67396a018970c2af4f51fb87/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk),参考nchar报错,![](https://pingcode.yasdb.com/atlas/files/public/67396a018970c2af4f51fb88/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk),SQL> insert into YDBRD4263_nchar_tb_04_2 values (lpad(' ',4001,' '));,YAS-02359 column C1 exceeds maxsize 8000 BYTES,SQL> desc YDBRD4263_nchar_tb_04_2;    
  NAME NULL? DATATYPE     
  ---------------------------------------------------------------- --------- ---------------------------------     
  C1 NCHAR(4000),SQL>|是|底层解码编码存在问题，同问题5|
|5|nnvarchar(2000)插入1999个表情包，length限制2000个字符|create table test89 (c1 nvarchar(2000));,  
,commit;,  
,select length(c1),lengthb(c1) from test89;|![](https://pingcode.yasdb.com/atlas/files/public/67396a018970c2af4f51fb89/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|  [YDBRD-16933](https://jira.yasdb.com/browse/YDBRD-16933?src=confmacro)    -  【nchar数据】定义nchar/nvarchar列，插入表情包字符，底层编码存在问题，占用字符数不正确  解决关闭|
|6|nvarchar(2000)，插入1999个表情包后，select *全量查询报错|基于步骤五的背景，select * from test89;|![](https://pingcode.yasdb.com/atlas/files/public/67396a01a1ad9a3311dc79fe/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|根因同问题5，提一个单跟踪|
|7|nchar(4000)，插入2000个表情包，查询length限制4001|create table YDBRD4263_nchar_tb_05_2 (c1 nchar(4000));,1 row affected.,SQL> select length(c1),lengthb(c1) from YDBRD4263_nchar_tb_05_2;,LENGTH(C1) LENGTHB(C1)     
  --------------------- ---------------------     
  4001 8000,1 row fetched.,SQL> desc YDBRD4263_nchar_tb_05_2;    
  NAME NULL? DATATYPE     
  ---------------------------------------------------------------- --------- ---------------------------------     
  C1 NCHAR(4000),补位，超出nchar的边界值4000|![](https://pingcode.yasdb.com/atlas/files/public/67396a02a1ad9a3311dc79ff/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|根因同问题5，提一个单跟踪|
|8|nchar(4000)，插入253个表情包,-e-f执行sql，补空后位3743个字符,  
|[test_sdv_nchar_datatype_06.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmY4OTcwYzJhZjRmNTFmYjcwIiwicmVmX2lkIjoiNjczOTY5ZmU1OTNmOTljOWZmMjM1NGNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNjkwLCJleHAiOjE3ODIyOTcwOTB9.ZzLV4T79VzxDjU-ysMqPC8yXd0HVxXUjPCPdU8s9zv8)|![](https://pingcode.yasdb.com/atlas/files/public/67396a02a1ad9a3311dc7a00/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|根因同问题5，提一个单跟踪|
|9|nchar表使用dbms_metadata.get_ddl高级包查询ddl语句，nchar的长度丢失|create table YDBRD4263_nchar_tb_10 (c1 nchar(1),c2 nchar(253),c3 nchar(2000),c4 nchar(2777),c5 nchar(4000));,select dbms_metadata.get_ddl('table','YDBRD4263_NCHAR_TB_10') from dual;|![](https://pingcode.yasdb.com/atlas/files/public/67396a02a1ad9a3311dc7a01/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|  [YDBRD-16934](https://jira.yasdb.com/browse/YDBRD-16934?src=confmacro)    -  【nchar数据】dbms_metadata.get_ddl高级包查询建表语句，nchar列长度丢失  解决关闭|
|10|range多列分区，插入符合分区范围的数据，报错无法匹配分区|create table YDBRD4263_nchar_tb_14 (id int,c1 nchar(990),c2 char,c3 nchar(4000),c5 nchar(995),c6 char(1)) partition by range(c5,c1,c6)    
  (    
  partition p1 values less than (100,100,1),    
  partition p2 values less than (200,200,3),    
  partition p3 values less than (200,300,4),    
  partition p4 values less than (200,300,5)    
  );,insert into YDBRD4263_nchar_tb_14 values(4,'300','1',lpad('果',2000,'水'),'200','4');    
  commit;,  
  select * from YDBRD4263_nchar_tb_14 partition(p4); --- 查询分区数据,  
|![](https://pingcode.yasdb.com/atlas/files/public/67396a028970c2af4f51fb8a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk),![](https://pingcode.yasdb.com/atlas/files/public/67396a02a1ad9a3311dc7a02/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|同样的SQL语句，char数据类型也存在问题，master主线会core，nchar转测包不会core，但是数据的分区不对,--主线问题，给主线提单：    [YDBRD-17036](https://jira.yasdb.com/browse/YDBRD-17036?src=confmacro)    -  【range分区】heap表range分区，多列char分区键，插入符合分区value的值后，分区数据错乱  非问题关闭|
|11|range分区，分区value值设定超过列长度中文字符，报错提示YAS-00220 utf8 sequence is wrong|create table YDBRD4263_nchar_tb_14_2 (id int,c1 nchar(990),c2 char,c3 nchar(4000),c5 nchar(1995),c6 nchar(1)) partition by range(c5)    
  (    
  partition p1 values less than (lpad('中',1996,'国'))    
  );|![](https://pingcode.yasdb.com/atlas/files/public/67396a028970c2af4f51fb8b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk),能考char列处理,![](https://pingcode.yasdb.com/atlas/files/public/67396a02a1ad9a3311dc7a03/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|  [YDBRD-17093](https://jira.yasdb.com/browse/YDBRD-17093?src=confmacro)    -  【nchar数据】nchar（1995）列作为range分区键，设定分区的上限值为1996个中文字符，报错YAS-00220 utf8 sequence is wrong，报错不合理  解决关闭|
|12|alter table命令修改表的range分区到interval分区，未拦截|create table YDBRD4263_nchar_tb_16 (id int,c1 nchar(990),c2 char,c3 nchar(4000),c5 nchar(1995),c6 nchar(1)) partition by range(c5)    
  (    
  partition p1 values less than (100),    
  partition p2 values less than (200),    
  partition p3 values less than (300),    
  partition p4 values less than (400)    
  );,ALTER TABLE YDBRD4263_nchar_tb_16 SET INTERVAL(4);|![](https://pingcode.yasdb.com/atlas/files/public/67396a028970c2af4f51fb8c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|主线问题：    [YDBRD-17037](https://jira.yasdb.com/browse/YDBRD-17037?src=confmacro)    -  【interval分区】heap表range分区，单char分区键，alter table  set interval 转换表分区类型为interval分区，执行成功，未拦截  解决关闭|
|13|空表char/varcahr列无法alter改成nchar列|create table YDBRD4263_nchar_tb_24_1 (c1 boolean,c2 char(8000),c3 varchar(32000),c4 char(8000 char),c5 varchar(32000 char),c6 varchar(8000),c7 varchar(2000 char),c8 char(2000 char));,alter table YDBRD4263_nchar_tb_24_1 modify c2 nchar(2000);    
  alter table YDBRD4263_nchar_tb_24_1 modify c6 nchar(253);    
  alter table YDBRD4263_nchar_tb_24_1 modify c7 nchar(4000);|![](https://pingcode.yasdb.com/atlas/files/public/67396a028970c2af4f51fb8d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk),Oracle可以,![](https://pingcode.yasdb.com/atlas/files/public/67396a02a1ad9a3311dc7a04/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|**记遗留问题，后面转需求落地 – 敬厅已跟SE 吴良智对齐**|
|14|nchar列带数据改小n长度，部分成功，部分失败|create table YDBRD4263_nchar_tb_27_1 (c1 nchar(1),c2 nchar(128),c3 nchar(1000),c4 nchar(2001),c5 nchar(4000),c6 nchar);,--insert 数据    
  insert into YDBRD4263_nchar_tb_27_1 values(1,lpad('中',128,'国'),lpad('中',1000,'国'),lpad('中',2001,'国'),lpad('中',4000,'国'),'a');    
  commit;,  
,--alter改大nchar长度，成功    
  alter table YDBRD4263_nchar_tb_27_1 modify c1 nchar(5);    
  alter table YDBRD4263_nchar_tb_27_1 modify c2 nchar(3999);    
  alter table YDBRD4263_nchar_tb_27_1 modify c5 nchar(4000);    
  alter table YDBRD4263_nchar_tb_27_1 modify c4 nchar(3999);    
  alter table YDBRD4263_nchar_tb_27_1 modify c3 nchar(2001);,  
,--alter 改小，但是大于实际存储的数据 --- 修改规则有问题，与Oracle差异    
  alter table YDBRD4263_nchar_tb_27_1 modify c1 nchar(2); -- 修改成功，Oracle报错    
  alter table YDBRD4263_nchar_tb_27_1 modify c2 nchar(1000); -- 修改成功，Oracle报错    
  alter table YDBRD4263_nchar_tb_27_1 modify c3 nchar(1000);     
  alter table YDBRD4263_nchar_tb_27_1 modify c4 nchar(2002);,  
,  
,  
|![](https://pingcode.yasdb.com/atlas/files/public/67396a028970c2af4f51fb8e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk),Oracle:,![](https://pingcode.yasdb.com/atlas/files/public/67396a028970c2af4f51fb8f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|  [YDBRD-17157](https://jira.yasdb.com/browse/YDBRD-17157?src=confmacro)    -  【nchar数据】nchar列带数据通过alter table改小列长度成功，Oracle报错  非问题关闭|
|15|alter table新增nchar列带默认值，length/lengthb查询新增列长度为默认值长度|create table YDBRD4263_nchar_tb_28 (,c2 nchar(128),c3 nchar(1000),c5 nchar(4000),c6 nchar);,alter table YDBRD4263_nchar_tb_28 add c1 nchar(4000) default 999999999;    
  alter table YDBRD4263_nchar_tb_28 add c4 nchar(1) default '中';    
  alter table YDBRD4263_nchar_tb_28 add c4099 nchar(2001) default lpad('表情包',2000,'表情包');,  
,select length(c1),length(c3),length(c4),length(c5),length(c6),length(c4099) from YDBRD4263_nchar_tb_28;,select lengthb(c1),lengthb(c3),lengthb(c4),lengthb(c5),lengthb(c6),lengthb(c4099) from YDBRD4263_nchar_tb_28;|![](https://pingcode.yasdb.com/atlas/files/public/67396a02a1ad9a3311dc7a05/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|  [YDBRD-17158](https://jira.yasdb.com/browse/YDBRD-17158?src=confmacro)    -  【nchar数据】alter table 新增nchar列带default默认值，length查询新增列长度，显示的是默认值的长度，应该显示nchar列定义的长度  解决关闭|
|16|update更新表数据，set nchar列插入raw，rowid，urowid数据失败，预期成功|create table YDBRD4263_nchar_tb_33 (c1 nchar(5),c2 nchar(128),c3 nchar(1000),c4 nchar(2001),c5 nchar(4000),c6 nchar(4000));,--插入1W行数据    
  declare    
  begin    
  for i in 1..10000 loop    
  insert into YDBRD4263_nchar_tb_33 values (i,lpad('中',128,'国'),lpad('a',1000,'b'),lpad('',2000,''),lpad('1',4000,'1'),'あ');    
  end loop;    
  commit;    
  end;    
  /,  
,update YDBRD4263_nchar_tb_33 set c2=cast('0011' as raw(64)) where c1<5001;    
  update YDBRD4263_nchar_tb_33 set c2=cast('112355:4:0:41102:1' as rowid) where c1 > 5000;    
  update YDBRD4263_nchar_tb_33 set c6=cast('ffffff' as urowid) where c1 > 5000;|![](https://pingcode.yasdb.com/atlas/files/public/67396a02a1ad9a3311dc7a06/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk),Oracle能成功,  
|是|  [YDBRD-17175](https://jira.yasdb.com/browse/YDBRD-17175?src=confmacro)    -  【NCHAR】n类型转rowid类型转换失败  解决关闭,  
|
|17|建表包含nchar、nvarchar、nclob列，插入100W数据，数据库core，core在utf8GetNext|create table YDBRD4263_nchar_tb_34 (c1 nchar(7),c2 nchar(1),c3 nchar(4000),c4 nvarchar(1),c5 nvarchar(16000),c6 nclob);,declare    
  begin    
  for i in 1..1000000 loop    
  insert into YDBRD4263_nchar_tb_34 values (i,'中',lpad('a',4000,'b'),1,lpad('表情包',8000,'表情包'),lpad(cast('中' as char),16000,cast('国' as char)));    
  end loop;    
  commit;    
  end;    
  /|![](https://pingcode.yasdb.com/atlas/files/public/67396a028970c2af4f51fb90/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|master版本问题，|
|18|建表包含nchar、nvarchar、nclob列，clob列插入10666个中文字符，报错|create table YDBRD4263_nchar_tb_34 (c1 nchar(7),c2 nchar(1),c3 nchar(4000),c4 nvarchar(1),c5 nvarchar(16000),c6 nclob);,declare    
  begin    
  for i in 1..1000000 loop    
  insert into YDBRD4263_nchar_tb_34 values (i,'中',lpad('a',4000,'b'),1,lpad('表情包',8000,'表情包'),lpad('中',10666,'国'));    
  end loop;    
  commit;    
  end;    
  /|![](https://pingcode.yasdb.com/atlas/files/public/67396a02a1ad9a3311dc7a07/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|0724号最新包已修复|
|19|nchar表，默认值带tinyint类型的数值，报错|create table YDBRD4263_nchar_tb_40 (    
  id int,    
  c1 nchar(2) default 0,    
  c2 nchar(1) default -0,    
  c3 nchar(2994) default cast(-128 as tinyint) primary key,    
  c4 nchar(999) default cast(127 as tinyint) check(length(c4)<1000),    
  c5 nchar(1000) default cast(-32768 as smallint),    
  c6 nchar(2001) default cast(32767 as smallint),    
  c7 nchar(4000) default -2147483648,    
  c8 nchar(4000) default 2147483647,    
  c9 nchar(3000) default -9223372036854775808,    
  c10 nchar(4000) default 9223372036854775807,    
  c11 nchar(4000) default 9223372036854775808,    
  c12 nchar(4000) default -3.402823E38,    
  c13 nchar(4000) default -1.401298E-45,    
  c14 nchar(4000) default 3.402823E38,    
  c15 nchar(4000) default 1.401298E-45,    
  c16 nchar(4000) default -1.79769313486232E308,    
  c17 nchar(4000) default -4.94065645841247E-324,    
  c18 nchar(4000) default 1.79769313486232E308,    
  c19 nchar(4000) default 4.94065645841247E-324    
  );|![](https://pingcode.yasdb.com/atlas/files/public/67396a02a1ad9a3311dc7a08/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|  [YDBRD-17296](https://jira.yasdb.com/browse/YDBRD-17296?src=confmacro)    -  【nchar数据】nchar列default默认值为ast(-128 as tinyint) ，建表报错  解决关闭|
|20|nchar列与char/varcahr列建立表达式索引，报错，与Oracle有差异|create table YDBRD4263_nchar_tb_41_1 (c1 nchar(4),c2 nchar(999),c3 char(201),c4 char(100 char),c5 varchar(1000),c6 varchar(100 char));,--插入数据    
  declare    
  begin    
  for i in 1..1000 loop    
  insert into YDBRD4263_nchar_tb_41_1 values (i,'中',i||',test,test,teset','水果','超时','水果');    
  end loop;    
  commit;    
  end;    
  /,--建立表达索引    
  create index YDBRD4263_index_41_06 on YDBRD4263_nchar_tb_41_1(c2||c5);    
  create index YDBRD4263_index_41_08 on YDBRD4263_nchar_tb_41_1(c2||c3||c4||c5||c6);|![](https://pingcode.yasdb.com/atlas/files/public/67396a02a1ad9a3311dc7a09/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk),![](https://pingcode.yasdb.com/atlas/files/public/67396a028970c2af4f51fb91/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|属于索引长度的规格差异，我们是6000，Oracle是32000|
|21|insert into  select方式将blob插入到nchar列，查询出现乱码|create table YDBRD4263_nchar_tb_49 (id int,c1 nchar(6),c2 nchar(6),c3 nchar(12),c4 nchar(10),c5 nchar(7));    
  create table YDBRD4263_nchar_tb_49_1 (c1 clob,c2 blob,c3 json,c4 nvarchar(4000),c5 nclob);,  
,insert into YDBRD4263_nchar_tb_49 values (    
  1,    
  (select c1 from YDBRD4263_nchar_tb_49_1),    
  (select c2 from YDBRD4263_nchar_tb_49_1),    
  (select c3 from YDBRD4263_nchar_tb_49_1),    
  (select c4 from YDBRD4263_nchar_tb_49_1),    
  (select c5 from YDBRD4263_nchar_tb_49_1)    
  );    
  commit;,备注：nclob已拦截，如果nchar拦截报错，哪通过cast函数转换的方式也需要拦截；已经试过char插入后也是乱码；|![](https://pingcode.yasdb.com/atlas/files/public/67396a038970c2af4f51fb92/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|  
|SE已沟通，维持原来样子，与Oracle保持一致|
|22|blob数据列与nclob，id拼接，使用length函数查询报错|create table YDBRD4263_nchar_tb_52_3 (id int,c1 clob,c2 blob,c3 json,c4 nvarchar2(1000),c5 nclob);,insert into YDBRD4263_nchar_tb_52_3 values (2,cast('中国clob' as nchar(4000)),cast('0011ab' as nchar(6)),cast('"中国json"' as nchar(999)),cast('中国nvarchar' as nchar(256)),cast('中国nclob' as nchar(2001)));    
  commit;,  
,select length(c1||c2||c3||c4||c5) from YDBRD4263_nchar_tb_52_3;|![](https://pingcode.yasdb.com/atlas/files/public/67396a03a1ad9a3311dc7a0a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk),![](https://pingcode.yasdb.com/atlas/files/public/67396a03a1ad9a3311dc7a0b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|  [YDBRD-17479](https://jira.yasdb.com/browse/YDBRD-17479?src=confmacro)    -  【nchar数据】blob数据列与nclob拼接，使用length函数查询报错 utf8 sequence is wrong  问题已转需求|
|23|nchar与数据型数据类型、rowid拼接式返回的nvarchar长度比Oracle多2.5倍|create table test1009 as select a.c5||b.c5 t1 from YDBRD4263_nchar_tb_54 a,YDBRD4263_nchar_tb_54_4 b;,create table YDBRD4263_nchar_tb_54_2 (id int,c1 raw(64),c2 bit,c3 rowid,c4 urowid,c5 boolean);,create table YDBRD4263_nchar_tb_54_8 (c1 int,c2 tinyint,c3 smallint,c4 bigint,c5 number,c6 float,c7 double,c8 number(25,100),c9 float(24),c10 int);,declare    
  begin    
  for i in 1..1000 loop    
  insert into YDBRD4263_nchar_tb_54 values (i,'中',i||',test,test,teset','水果','超时','水果','测试test');    
  insert into YDBRD4263_nchar_tb_54_2 values (i,'ffffff','1','2265:4:0:30092:0','ffffff',true);    
  insert into YDBRD4263_nchar_tb_54_8 values (1,-128,-32768,-9223372036854775808,-9223372036854775809,-3.402823E38,-1.79769313486232E308,0,-9223372036854775809.99999,-2147483648);    
  end loop;    
  commit;    
  end;    
  /,  
,create table test1000 as select a.c2||b.c3 t1,length(a.c2||b.c3) t2,lengthb(a.c2||b.c3) t3 from YDBRD4263_nchar_tb_54 a,YDBRD4263_nchar_tb_54_2 b;,create table test1006 as select a.c2||b.c5 t1,length(a.c2||b.c5) t2,lengthb(a.c2||b.c5) t3 from YDBRD4263_nchar_tb_54 a,YDBRD4263_nchar_tb_54_8 b；|![](https://pingcode.yasdb.com/atlas/files/public/67396a038970c2af4f51fb93/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk),![](https://pingcode.yasdb.com/atlas/files/public/67396a038970c2af4f51fb94/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|  [YDBRD-17480](https://jira.yasdb.com/browse/YDBRD-17480?src=confmacro)    -  【nchar数据】nchar与数据型数据类型、rowid拼接式返回的nvarchar长度比Oracle多2.5倍  解决关闭,  [[YDBRD-17822] CLONE - 【nchar数据】nchar与数据型数据类型、rowid拼接式返回的nvarchar长度比Oracle多2.5倍 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-17822)  ,同步22.2|
|24|ceate table as  select nchar与char通过||拼接，转换长度超过4000字符，8000字节的长度，Oracle会拦截报错，我们会建表成功|create table test1009 as select a.c5||b.c5 t1 from YDBRD4263_nchar_tb_54 a,YDBRD4263_nchar_tb_54_4 b;,create table YDBRD4263_nchar_tb_54_4 (c1 char(4),c2 char,c3 char(2994),c4 char(999),c5 char(256),c6 char(2001),c7 char(4000),c8 char(8000));    
  create table YDBRD4263_nchar_tb_54_5 (c1 char(4 char),c2 char(1 char),c3 char(2994 char),c4 char(999 char),c5 char(256 char),c6 char(2001 char),c7 char(4000 char),c8 char(8000 char));    
    
,declare    
  begin    
  for i in 1..1000 loop    
  insert into YDBRD4263_nchar_tb_54 values (i,'中',i||',test,test,teset','水果','超时','水果','测试test');    
  insert into YDBRD4263_nchar_tb_54_4 values (i,'0',i||',test,test,teset,char(nchar)','水果char(nchar)','超时char(nchar)','水果char(nchar)','测试testchar(nchar)','测试testchar8000');    
  insert into YDBRD4263_nchar_tb_54_5 values (i,'1',i||',test,test,teset,char(nchar)','水果char(nchar)','超时char(nchar)','水果char(nchar)','测试testchar(nchar)','测试testchar(nchar)8000');    
  end loop;    
  commit;    
  end;    
  /,create table test1200 as select distinct a.c6||b.c6 t0 from YDBRD4263_nchar_tb_54 a,YDBRD4263_nchar_tb_54_4 b;|![](https://pingcode.yasdb.com/atlas/files/public/67396a038970c2af4f51fb95/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk),![](https://pingcode.yasdb.com/atlas/files/public/67396a03a1ad9a3311dc7a0c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|  [YDBRD-17481](https://jira.yasdb.com/browse/YDBRD-17481?src=confmacro)    -  【nchar数据】create table as  select nchar与char通过||拼接，转换长度超过4000字符，8000字节的长度，Oracle会拦截报错，我们会建表成功  非问题关闭|
|25|nchar超长列与char超长列||拼接，结合distinct去重，sql查询耗时4min53s|create table test1009 as select a.c5||b.c5 t1 from YDBRD4263_nchar_tb_54 a,YDBRD4263_nchar_tb_54_4 b;,create table YDBRD4263_nchar_tb_54_4 (c1 char(4),c2 char,c3 char(2994),c4 char(999),c5 char(256),c6 char(2001),c7 char(4000),c8 char(8000));    
  create table YDBRD4263_nchar_tb_54_5 (c1 char(4 char),c2 char(1 char),c3 char(2994 char),c4 char(999 char),c5 char(256 char),c6 char(2001 char),c7 char(4000 char),c8 char(8000 char));    
    
,declare    
  begin    
  for i in 1..1000 loop    
  insert into YDBRD4263_nchar_tb_54 values (i,'中',i||',test,test,teset','水果','超时','水果','测试test');    
  insert into YDBRD4263_nchar_tb_54_4 values (i,'0',i||',test,test,teset,char(nchar)','水果char(nchar)','超时char(nchar)','水果char(nchar)','测试testchar(nchar)','测试testchar8000');    
  insert into YDBRD4263_nchar_tb_54_5 values (i,'1',i||',test,test,teset,char(nchar)','水果char(nchar)','超时char(nchar)','水果char(nchar)','测试testchar(nchar)','测试testchar(nchar)8000');    
  end loop;    
  commit;    
  end;    
  /,select distinct a.c5||b.c8,typeof(a.c5||b.c8,1),length(a.c5||b.c8),lengthb(a.c5||b.c8) from YDBRD4263_nchar_tb_54 a,YDBRD4263_nchar_tb_54_4 b;,开启sql统计时间：set timing on,Elapsed: 00:03:30.337,  
,场景2：,select distinct a.c5||b.c8,typeof(a.c5||b.c8,1),length(a.c5||b.c8),lengthb(a.c5||b.c8) from YDBRD4263_nchar_tb_54 a,YDBRD4263_nchar_tb_54_5 b;,  
  Elapsed: 00:04:53.848|![](https://pingcode.yasdb.com/atlas/files/public/67396a038970c2af4f51fb96/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|  
|  [YDBRD-17482](https://jira.yasdb.com/browse/YDBRD-17482?src=confmacro)    -  【nchar数据】nchar超长列与char超长列 通过 ||  拼接，结合distinct去重，sql查询耗时太长（4min53s）  解决关闭|
|26|range分区指定多列nchar列，建表报错|SQL> create table YDBRD4263_nchar_tb_14 (id int,c1 nchar(990),c2 char,c3 nchar(4000),c5 nchar(995),c6 nchar(1)) partition by range(c5,c1,c6)    
  2 (    
  3 partition p1 values less than (100,100,1),    
  4 partition p2 values less than (200,200,3),    
  5 partition p3 values less than (200,300,4),    
  6 partition p4 values less than (200,300,5)    
  7 );|![](https://pingcode.yasdb.com/atlas/files/public/67396a03a1ad9a3311dc7a0d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk),![](https://pingcode.yasdb.com/atlas/files/public/67396a038970c2af4f51fb97/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|  
|
|27|range分区，nchar列与其他列混合为分区键，插入符合分区的数据，分区数据存储分区错误|Oracle对比语句：,create table YDBRD4263_nchar_tb_15 (id int,c1 date,c2 char,c3 nchar(1000),c5 nchar(995),c6 varchar(1),c7 number,c8 nvarchar2(5)) partition by range(c5,c1,c6,c7,c8)    
  (    
  partition p1 values less than (100,TO_DATE('2021-01-01','YYYY-MM-DD'),1,100,'0001'),    
  partition p2 values less than (200,TO_DATE('2022-01-01','YYYY-MM-DD'),4,200,'0001'),    
  partition p3 values less than (200,TO_DATE('2022-01-01','YYYY-MM-DD'),4,200,'0010'),    
  partition p4 values less than (200,TO_DATE('2022-01-01','YYYY-MM-DD'),4,300,'0001'),    
  partition p5 values less than (200,TO_DATE('2022-01-01','YYYY-MM-DD'),5,300,'0001'),    
  partition p6 values less than (200,TO_DATE('2023-01-01','YYYY-MM-DD'),5,300,'0001'),    
  partition p7 values less than (300,TO_DATE('2023-01-01','YYYY-MM-DD'),4,300,'0001')    
  );,  
  --P1    
  insert into YDBRD4263_nchar_tb_15 values(1,TO_DATE('2024-01-01','YYYY-MM-DD'),'0',lpad('果',1000,'水'),'100','1',399,'1111');    
  --p6    
  insert into YDBRD4263_nchar_tb_15 values(2,TO_DATE('2023-01-01','YYYY-MM-DD'),'0',lpad('果',1000,'水'),'200','1',399,'1111');    
  --p5    
  insert into YDBRD4263_nchar_tb_15 values(3,TO_DATE('2022-01-01','YYYY-MM-DD'),'0',lpad('果',1000,'水'),'200','5',399,'1111');    
  --p4    
  insert into YDBRD4263_nchar_tb_15 values(4,TO_DATE('2022-01-01','YYYY-MM-DD'),'0',lpad('果',1000,'水'),'200','4',300,'1111');    
  --p2    
  insert into YDBRD4263_nchar_tb_15 values(5,TO_DATE('2022-01-01','YYYY-MM-DD'),'1',lpad('果',1000,'水'),'200','4',200,'0001');    
  --p3    
  insert into YDBRD4263_nchar_tb_15 values(6,TO_DATE('2022-01-01','YYYY-MM-DD'),'1',lpad('果',1000,'水'),'200','4',200,'0010');    
  --p7    
  insert into YDBRD4263_nchar_tb_15 values(7,TO_DATE('2023-01-01','YYYY-MM-DD'),'1',lpad('果',1000,'水'),'300','4',1,'1111');    
  commit;|![](https://pingcode.yasdb.com/atlas/files/public/67396a038970c2af4f51fb98/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|  
|
|27|list分区插入符合分区的数据，报错分区不匹配|create table YDBRD4263_nchar_tb_17 (id int,c1 nchar(990),c2 char,c3 nchar(4000),c5 nchar(1995),c6 nchar(1)) partition by list(c5)    
  (    
  partition p1 values ('a'),    
  partition p2 values ('中国'),    
  partition p3 values (200)    
  );,--插入数据    
  insert into YDBRD4263_nchar_tb_17 values (1,'1','1','1','a','1');    
  insert into YDBRD4263_nchar_tb_17 values (2,'1','1','1','中国','1');    
  insert into YDBRD4263_nchar_tb_17 values (3,'1','1','1',200,'1');    
  commit;|![](https://pingcode.yasdb.com/atlas/files/public/67396a03a1ad9a3311dc7a0e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBU0JDSUFDSmdDSVFBUUFDVENBRUFBZ0FRUUNDQUFCS0FDQklFRUlncmhBUUlKSXdnQ2dnQUFBQUJad0FBcUFlaUJrQUFjQWdhR0FZb0lFQmlWeVlnSXlJQnNpQ0lRQURBQURFUUFBRWd5QjBRQ1FBZ1N4QUFRUUFTZzRRQ1NBQUFRQUJnRUFBQ0JBQVFNQ0FCU0NnQUFCQ0lCQUJBSVFDUUFKZ0FDQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTA2OTAsImV4cCI6MTc4MjIyMTQ5MH0.ltlBZrZwU57KF0OEp4wtpiNNcU6djO2mZKGA0YsNsqk)|是|  
|
|  
|  
|  
|  
|  
|  
|


## Attachments:

[image2023-7-14_12-20-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmZhMWFkOWEzMzExZGM3OWU3IiwicmVmX2lkIjoiNjczOTY5ZmU1OTNmOTljOWZmMjM1NGNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNjkwLCJleHAiOjE3ODIyOTcwOTB9.HLEDzboBA7o6hrKyh9YLkqGr_oSq0BJiYl7uuW-lAjI)

 (image/png)    


[test_sdv_nchar_datatype_06.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmY4OTcwYzJhZjRmNTFmYjcwIiwicmVmX2lkIjoiNjczOTY5ZmU1OTNmOTljOWZmMjM1NGNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNjkwLCJleHAiOjE3ODIyOTcwOTB9.ZzLV4T79VzxDjU-ysMqPC8yXd0HVxXUjPCPdU8s9zv8)

 (application/octet-stream)    


[image2023-7-18_18-2-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDA4OTcwYzJhZjRmNTFmYjc3IiwicmVmX2lkIjoiNjczOTY5ZmU1OTNmOTljOWZmMjM1NGNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNjkwLCJleHAiOjE3ODIyOTcwOTB9.PoVkjHOfmGzza4OAn89TLjwmCwJ3dSjkTe1eMSYl1Dg)

 (image/png)    


[image2023-7-22_11-32-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDBhMWFkOWEzMzExZGM3OWYyIiwicmVmX2lkIjoiNjczOTY5ZmU1OTNmOTljOWZmMjM1NGNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNjkwLCJleHAiOjE3ODIyOTcwOTB9.iKItp8rxcHf_DZrUp5DTw9UYhiwycmlpC9xDjBqMId4)

 (image/png)    


[test_sdv_nchar_datatype_15.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDFhMWFkOWEzMzExZGM3OWZiIiwicmVmX2lkIjoiNjczOTY5ZmU1OTNmOTljOWZmMjM1NGNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNjkwLCJleHAiOjE3ODIyOTcwOTB9.eoN15HtP9dOo4rXSfAP3EAesyQ1h-DIETZcpTz_v6XE)

 (application/octet-stream)    
