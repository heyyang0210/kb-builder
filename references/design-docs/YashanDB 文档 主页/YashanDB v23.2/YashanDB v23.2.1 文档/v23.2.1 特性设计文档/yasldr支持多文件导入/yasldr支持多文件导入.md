Created by 贺国锋, last modified on 十二月 13, 2023

## 1. Overview（概述）

需求来源：    [YDBRD-22183](https://jira.yasdb.com/browse/YDBRD-22183?src=confmacro)    -  【yasldr】支持指定多个csv或目录的方式进行导入  完成

yasldr目前只支持单表单文件导入，在需要导入的表的数据是多个文件时，需要多次启动yasldr来执行导入，影响性能。

## 2. Features（功能特性）

1、yasldr支持指定多个文件进行导入。

2、yasldr支持指定*和？通配符导入。

## 3. Interfaces（接口）

1、支持在Load 语句中指定多个导入文件，语法格式同服务端Load Data保持一致，具体格式类似如下：

LOAD DATA OPTIONS(DEGREE_OF_PARALLELISM=3) INFILE '/home/yasdb/loadexample/csv01.csv' FIELDS TERMINATED BY ',' BADFILE '/home/yasdb/loadexample/csv01.bad' INFILE '/home/yasdb/loadexample/csv02.csv' FIELDS TERMINATED BY ',' BADFILE '/home/yasdb/loadexample/csv02.bad' INSERT INTO TABLE yasldr_multi_file_example(c1,c2);

2、支持在LOAD DATA语句中使用通配符*和?指定匹配的所有文件进行导入，具体语法格式如下：

LOAD DATA OPTIONS(DEGREE_OF_PARALLELISM=3) INFILE '/home/yasdb/loadexample/csv0?.csv' FIELDS TERMINATED BY ',' BADFILE '/home/yasdb/loadexample/csv01.bad' INSERT INTO TABLE yasldr_multi_file_example(c1,c2);

LOAD DATA OPTIONS(DEGREE_OF_PARALLELISM=3) INFILE '/home/yasdb/loadexample/csv*.csv' FIELDS TERMINATED BY ',' BADFILE '/home/yasdb/loadexample/csv.bad' INSERT INTO TABLE yasldr_multi_file_example(c1,c2);

## 4. Limitations（功能限制）

1、不支持指定导入多张表

2、多文件导入时，最多支持250个文件同时导入一张表，这一点和服务端导入保持一致。

3、使用*或？通配符时，*匹配0个或多个字符，而？匹配一个字符，这一点和正则表达式语义保持一致。

4、当使用*或？通配符时，若后面跟随的INFILE指定的文件与通配符匹配的文件重名，则报重名错误，这一点和使用多个INFILE指定时保持一致。

     – – 这里的行为和Oracle不一致，但是Oracle的用户体验不好，当指定多个同名文件时，他会导入多次。目前我们服务端导入是指定多个同名文件时会报错，客户端保持该行为。

## 5. Detail Design（详细设计）

### 5.1 总体设计

- 和服务端导入保持一致，客户端最大支持250个文件同时导入一张表，超过文件数限制时，需要报错并终止导入。
- 在指定为*或？正则表达式时，在解析阶段，需要去遍历目录，将目录下所有满足正则表达式条件的文件挂载到  LoadContext->dataDefs结构中。
- 客户端文件路径支持相对路径和绝对路径，而服务端目前只支持绝对路径，服务端保持绝对路径的约束不变。


关于多文件数据的读取逻辑，目前代码已经实现，本次开发不涉及，下面仅画出多文件数据的处理逻辑。

![](https://pingcode.yasdb.com/atlas/files/public/67396c33a1ad9a3311dc886f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFBQUFBQUJBQUNDQUFBQUFBUUFBZ0FBQU1BQUFBQUFJQUVBQUJBRUFBQUFBQUNBUVFBRUFBUUFJb0FBQUlCQUFnQUJBQUFBQUFJQUFBQUFBQUFFRUJBQUFBQUFBQUFBUWdBQUFCQUFBQUFnUUFBSWdBQUFBQUFBQUFBQUFBQ0NBQUFBQUFRQWdBQUFBQ0FBQUFnQUFnQUFBQUFBQkFCQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2ODIsImV4cCI6MTc4MjMxMDQ4Mn0.f_XqD1RyJRKddiP76osvn0hOLwiKCD41ukiRTp5CBW8)

#### 5.1.1 日志文件

- 导入过程产生一个日志文件，日志文件中记录的信息和现状保持一致，即记录了导入的表列信息，导入过程中的错误信息，导入结束后的统计信息等。
- 在没有设置日志文件路径和名称时，yasldr自动生成日志文件，生成的的日志文件，和导入指定的第一个数据文件的路径和名称保持一致，后缀不同，日志名称后缀为.log。
- 若指定的输入文件名称时正则表达式，则生成的日志文件的名称和第一个挂载的数据文件的名称保持一致。


#### 5.1.2 BAD文件和DISC文件

- BAD文件和DISC文件的处理和服务端导入保持一致。
- 即针对每一个导入的数据文件，若数据文件中存在BAD数据或DISC数据，产生对应的BAD文件和DISC文件。
- 生成BAD文件和DISC文件的控制逻辑和单文件导入保持一致，即无论是否指定BAD都产生bad文件，指定DISC时产生disc文件。
- 在指定的多个INFILE后面跟随的BADFILE同名时，或者INFILE的文件名称为正则表达式且后跟BADFILE时，多个INFILE的BAD数据会写入同一个BAD文件，且写入方式为追加的方式。 


           – – 这一点和ORACLE不一致，ORACLE会覆盖，用户体验不好。多个输入的BAD数据应该全部保留，待客户修改后重新导入使用。

### 5.2 功能实现

#### 5.2.1 语法解析

1、目前语法解析时，在loadClientParseFileCnt()函数中对客户端导入文件的数量进行了限制，需要进行适配。

2、新增支持文件名称中使用*或者？正则表达式语法，具体语法格式参见3.2中语法格式。

执行流程如下

![](https://pingcode.yasdb.com/atlas/files/public/67396c338970c2af4f520a02/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFBQUFBQUJBQUNDQUFBQUFBUUFBZ0FBQU1BQUFBQUFJQUVBQUJBRUFBQUFBQUNBUVFBRUFBUUFJb0FBQUlCQUFnQUJBQUFBQUFJQUFBQUFBQUFFRUJBQUFBQUFBQUFBUWdBQUFCQUFBQUFnUUFBSWdBQUFBQUFBQUFBQUFBQ0NBQUFBQUFRQWdBQUFBQ0FBQUFnQUFnQUFBQUFBQkFCQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2ODIsImV4cCI6MTc4MjMxMDQ4Mn0.f_XqD1RyJRKddiP76osvn0hOLwiKCD41ukiRTp5CBW8)

    

#### 5.2.2 容错

每一个待导入的数据文件都对应有相应的bad文件和disc文件，用来存储bad数据和discard数据，存储格式和单文件导入一致。

指定多文件或目录导入时，ERRORS容错上限在所有文件之间共享，即假定ERROR指定为20，文件1中有10条error数据，则在文件2中导入时，若出现10条ERROR数据，则终止导入。

DISCARDS针对单文件进行设计，因为DISCARDS在INFILE中，文件导入时达到DISCARDS上限后，将正常数据发送，跳过当前文件，继续处理下一个文件。

目前bad文件和disc文件都是针对单文件导入设计，需要改写yasLdrLogger逻辑，支持多文件数据。

##### 5.2.1 LOGGER初始化

主线程在执行时，需要初始化LoadLogger模块，完成log文件的设置，并准备bad和disc文件的相关控制信息。

##### 5.2.2 Bad或Discard文件写入

多个线程之间写入Bad文件或Discard文件时需要加锁控制，具体处理逻辑如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396c338970c2af4f520a03/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFBQUFBQUJBQUNDQUFBQUFBUUFBZ0FBQU1BQUFBQUFJQUVBQUJBRUFBQUFBQUNBUVFBRUFBUUFJb0FBQUlCQUFnQUJBQUFBQUFJQUFBQUFBQUFFRUJBQUFBQUFBQUFBUWdBQUFCQUFBQUFnUUFBSWdBQUFBQUFBQUFBQUFBQ0NBQUFBQUFRQWdBQUFBQ0FBQUFnQUFnQUFBQUFBQkFCQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2ODIsImV4cCI6MTc4MjMxMDQ4Mn0.f_XqD1RyJRKddiP76osvn0hOLwiKCD41ukiRTp5CBW8)

Binder线程在写入Bad或Discard文件时，若对应的文件未创建，则创建文件，然后将文件句柄信息缓存，以便其他Binder线程可以使用。

##### 5.2.3 LOGGER退出

在执行完导入后，退出前，需要完成LOGGER的收尾，将对应的数据刷盘，释放文件句柄等。

## 6. Testcases（自测用例）

### 6.1 正常场景

#### 6.1.1 多个文件同时导入，每个文件都有数据

#### 6.1.2 多个文件同时导入，部分文件为空

#### 6.1.3 文件名称含正则表达式导入

### 6.2 容错场景

#### 6.2.1 多个文件同时导入，每个文件都有错误数据

#### 6.2.2 多个文件同时导入，部分文件有错误数据

#### 6.2.3 文件名称含正则表达式导入

## 7. Workload（工作量）

  


*评估代码量KLOC、工作量（人天）。*

  


## 8. TODO（遗留问题）

*说明本方案遗留的问题或下一步需要解决的问题。*

不涉及。

## Attachments:

[binder线程拆分示意图.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzI4OTcwYzJhZjRmNTIwOWY1IiwicmVmX2lkIjoiNjczOTZjMzI3MjgyMDZlZmI5MmYwZWY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NjgyLCJleHAiOjE3ODIzODYwODJ9.Y-_bizdgradEeQBUy5IFxPIpmBWelZcPmJ3vIvqL8B0)

 (image/jpeg)    


[多文件和目录语法解析.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzI4OTcwYzJhZjRmNTIwOWY2IiwicmVmX2lkIjoiNjczOTZjMzI3MjgyMDZlZmI5MmYwZWY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NjgyLCJleHAiOjE3ODIzODYwODJ9.YEWlT5Di4dC2U5BO16_V8Yk6KeMvpbh2ty0ULp6zLK8)

 (image/jpeg)    


[多文件和目录语法解析.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzNhMWFkOWEzMzExZGM4ODZlIiwicmVmX2lkIjoiNjczOTZjMzI3MjgyMDZlZmI5MmYwZWY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NjgyLCJleHAiOjE3ODIzODYwODJ9.3CAqT1gDcgUxsm-zCRQ8PE5OfHZcpDlcbHycMS6b42U)

 (image/jpeg)    


## Comments:

|  [](null)  ,1、废除接口中的语法2，和oracle保持一致，使用*和？正则匹配进行多文件匹配，具体匹配规则为：,      ？匹配单个有效字符，,      *  匹配1个或多个有效字符 （确认星号匹配0个还是1个）,2、客户端导入支持相对路径，服务端导入不支持相对路径。,3、多文件情况下，需要在日志中显示数据文件对应的bad文件和disc文件,  
,Posted by heguofeng at 十月 31, 2023 15:10|
|---|
|  [](null)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396c338970c2af4f520a05/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFBQUFBQUJBQUNDQUFBQUFBUUFBZ0FBQU1BQUFBQUFJQUVBQUJBRUFBQUFBQUNBUVFBRUFBUUFJb0FBQUlCQUFnQUJBQUFBQUFJQUFBQUFBQUFFRUJBQUFBQUFBQUFBUWdBQUFCQUFBQUFnUUFBSWdBQUFBQUFBQUFBQUFBQ0NBQUFBQUFRQWdBQUFBQ0FBQUFnQUFnQUFBQUFBQkFCQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2ODIsImV4cCI6MTc4MjMxMDQ4Mn0.f_XqD1RyJRKddiP76osvn0hOLwiKCD41ukiRTp5CBW8), 经确认 oracle的行为就是常规的正则表达式的语义 * 匹配的就是零个或多个,Posted by heguofeng at 十一月 01, 2023 09:32|
|  [](null)  ,oracle行为调研：,![](https://pingcode.yasdb.com/atlas/files/public/67396c33a1ad9a3311dc8873/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFBQUFBQUJBQUNDQUFBQUFBUUFBZ0FBQU1BQUFBQUFJQUVBQUJBRUFBQUFBQUNBUVFBRUFBUUFJb0FBQUlCQUFnQUJBQUFBQUFJQUFBQUFBQUFFRUJBQUFBQUFBQUFBUWdBQUFCQUFBQUFnUUFBSWdBQUFBQUFBQUFBQUFBQ0NBQUFBQUFRQWdBQUFBQ0FBQUFnQUFnQUFBQUFBQkFCQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2ODIsImV4cCI6MTc4MjMxMDQ4Mn0.f_XqD1RyJRKddiP76osvn0hOLwiKCD41ukiRTp5CBW8),![](https://pingcode.yasdb.com/atlas/files/public/67396c33a1ad9a3311dc8875/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFBQUFBQUJBQUNDQUFBQUFBUUFBZ0FBQU1BQUFBQUFJQUVBQUJBRUFBQUFBQUNBUVFBRUFBUUFJb0FBQUlCQUFnQUJBQUFBQUFJQUFBQUFBQUFFRUJBQUFBQUFBQUFBUWdBQUFCQUFBQUFnUUFBSWdBQUFBQUFBQUFBQUFBQ0NBQUFBQUFRQWdBQUFBQ0FBQUFnQUFnQUFBQUFBQkFCQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2ODIsImV4cCI6MTc4MjMxMDQ4Mn0.f_XqD1RyJRKddiP76osvn0hOLwiKCD41ukiRTp5CBW8),![](https://pingcode.yasdb.com/atlas/files/public/67396c33a1ad9a3311dc8876/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFBQUFBQUJBQUNDQUFBQUFBUUFBZ0FBQU1BQUFBQUFJQUVBQUJBRUFBQUFBQUNBUVFBRUFBUUFJb0FBQUlCQUFnQUJBQUFBQUFJQUFBQUFBQUFFRUJBQUFBQUFBQUFBUWdBQUFCQUFBQUFnUUFBSWdBQUFBQUFBQUFBQUFBQ0NBQUFBQUFRQWdBQUFBQ0FBQUFnQUFnQUFBQUFBQkFCQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2ODIsImV4cCI6MTc4MjMxMDQ4Mn0.f_XqD1RyJRKddiP76osvn0hOLwiKCD41ukiRTp5CBW8),![](https://pingcode.yasdb.com/atlas/files/public/67396c348970c2af4f520a07/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFBQUFBQUJBQUNDQUFBQUFBUUFBZ0FBQU1BQUFBQUFJQUVBQUJBRUFBQUFBQUNBUVFBRUFBUUFJb0FBQUlCQUFnQUJBQUFBQUFJQUFBQUFBQUFFRUJBQUFBQUFBQUFBUWdBQUFCQUFBQUFnUUFBSWdBQUFBQUFBQUFBQUFBQ0NBQUFBQUFRQWdBQUFBQ0FBQUFnQUFnQUFBQUFBQkFCQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2ODIsImV4cCI6MTc4MjMxMDQ4Mn0.f_XqD1RyJRKddiP76osvn0hOLwiKCD41ukiRTp5CBW8),![](https://pingcode.yasdb.com/atlas/files/public/67396c34a1ad9a3311dc8878/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFBQUFBQUJBQUNDQUFBQUFBUUFBZ0FBQU1BQUFBQUFJQUVBQUJBRUFBQUFBQUNBUVFBRUFBUUFJb0FBQUlCQUFnQUJBQUFBQUFJQUFBQUFBQUFFRUJBQUFBQUFBQUFBUWdBQUFCQUFBQUFnUUFBSWdBQUFBQUFBQUFBQUFBQ0NBQUFBQUFRQWdBQUFBQ0FBQUFnQUFnQUFBQUFBQkFCQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2ODIsImV4cCI6MTc4MjMxMDQ4Mn0.f_XqD1RyJRKddiP76osvn0hOLwiKCD41ukiRTp5CBW8),  
,Posted by heguofeng at 十一月 01, 2023 11:23|
|  [](null)  ,结合服务端导入现状和oracle调研结果刷新文档,Posted by heguofeng at 十一月 01, 2023 17:54|
