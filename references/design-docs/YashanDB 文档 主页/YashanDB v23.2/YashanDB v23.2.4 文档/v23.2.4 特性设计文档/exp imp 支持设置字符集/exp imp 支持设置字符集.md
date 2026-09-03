Created by 程康, last modified on 七月 08, 2024

##   [1. 总述](#1-总述)  

1、数据装载要支持指定不同的字符集（GBK,GBK 18030-2022）进行自动转换。（imp） 

2、数据卸载要支持指定不同的字符集（GBK,GBK 18030-2022）进行自动转换。（exp）

###   [1.1 需求来源](#11-需求来源)  

  [https://pingcode.yasdb.com/pjm/items/661156a4579a3edb84d68d51](https://pingcode.yasdb.com/pjm/items/661156a4579a3edb84d68d51)    ?    
  #YDBRD-19179 【imp】支持指定字符集导入

  


  [https://pingcode.yasdb.com/pjm/items/661156a7579a3edb84d68d5d](https://pingcode.yasdb.com/pjm/items/661156a7579a3edb84d68d5d)    ?    
  #YDBRD-19180 【exp】支持指定字符集导出

###   [1.2 调研文档](#12-调研文档)  

|导出内容|sqluldr2|
|---|---|
|csv|导出文件字符集与客户端字符集一致|


###   [1.3 需求分析](#13-需求分析)  

###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

不涉及

##   [2. 接口](#2-接口)  

导出 sql元数据   --sql   character_set 

导出 csv              --csv  --character-set  (-ch)

```
exp --sql ck/1 file=x  character_set=gbk

exp --csv -u ck -p 1 -T t1 --character-set gbk
```

默认值是client/yasc_env.ini  里配置的字符集

##   [3. 规格与约束](#3-规格与约束)  

可选范围：UTF8、GBK、ASCII、ISO88591、GB18030

|exp|默认|修改后|
|---|---|---|
|导出二进制|默认服务端字符集导出|适配命令行输入中文用户名，表名导出，包括错误信息，进度展示为客户端字符集|
|导出 csv|默认以客户端字符集导出|exp --csv ck/1  --character-set gbk （-ch gbk）,导出后csv字符集为参数设置的字符集|
|导出 sql元数据|默认以客户端字符集导出（需在已知bug中修改）|exp --sql ck/1 character_set=gbk、,导出后元数据sql为参数设置的字符集|


|imp|默认|修改后|
|---|---|---|
|导入二进制|以exp文件的字符集导入（服务端字符集）|适配命令行输入中文用户名，表名导入，包括错误信息，进度展示为客户端字符集|


##   [4. 特性](#4-特性)  

![](https://pingcode.yasdb.com/atlas/files/public/67396db7a1ad9a3311dc933e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkVDQVFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTEwNDgsImV4cCI6MTc4MjMyMTg0OH0.jdGbFe8ewCElsRKIHmHfRIl7-JcF0HqgvuAMBLjre24)

  


  


  


exp --csv

1、多线程模式

2、配置参数影响导出lob字符集

3、适配 --query参数

exp --sql

1、支持设置字符集参数

exp

1、不支持设置字符集参数，按照服务端字符集导出

imp

1、不支持设置字符集参数，按照exp文件字符集导入

  


  


打屏日志与设置字符集无关，保持客户端字符集   client/yasc_env.ini

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1、中文表名、用户名

2、服务端gbk

|客户端|服务端|
|---|---|
|gbk|gbk|
|utf8|utf8|


create user   一   identified   by   1  ;    
  create user   二   identified   by   2  ;    
  create user   三是   identified   by   2  ;    
  create table    一  .  table1   (  c1   int  );    
  create table    一  .  表一   (  c1   int  );    
  create table    一  .  表二   (  c1   varchar  (  10  ));    
  insert into   一  .  表二   values  (  '  李开复  '  );    
  insert into   一  .  表一   values  (  1123  );    
  insert into   一  .  table1   values  (  1  );    
  grant   dba   to   一  ;    
  grant   dba   to   二  ;    
    


|  
|  
|  
|
|---|---|---|
|exp --csv -u sys -p Cod-2022 -O 一 -T 表二 -f csv -ch gbk --use-threads 20|exp --csv 中文表名|  
|
|exp --csv -u sys -p Cod-2022 -O 一 -T 表二 -f csv -ch gbk|  
|  
|
|exp --csv -u sys -p Cod-2022 -O 一 -T 表二 -f csv|  
|  
|
|exp --csv -u 一 -p 1 -O 一 -T 表二 -f csv|中文用户登录|  
|
|exp --csv -u 一 -p 1 -O 一 -T 表二 -f csv -ch gbk|  
|  
|
|exp --csv -u 一 -p 1 -O 一 -T 表二 -f csv -ch gbk --use-threads 20|  
|  
|
|exp --csv -u sys -p Cod-2022 -O sys -T ck,ck1 -f csv -ch gbk|多表|  
|
|exp --csv -u sys -p Cod-2022 -O 一 -T 表一,表二 -f csv -ch gbk|  
|  
|
|exp --csv -u sys -p Cod-2022 -O 一 -T 表一,表二 -f csv|  
|  
|
|  
|配置文件|  
|
|  
|  
|  
|
|exp 一/1 file=x full=y|exp & imp|  
|
|imp 一/1 file=x full=y|  
|  
|
|exp 一/1 file=x owner=一|  
|  
|
|imp 一/1 file=x fromuser=一|  
|  
|
|imp 一/1 file=x fromuser=一 touser=二|  
|  
|
|exp 一/1 file=文件  tables=表一,表二|  
|  
|
|exp sys/Cod-2022 file=文件 tables=一.表一,表二|  
|  
|
|exp sys/Cod-2022 file=x tables=一.表一,表二|  
|  
|
|imp 一/1 file=文件 fromuser=一 touser=二|  
|  
|
|imp 一/1 file=x fromuser=一 touser=二|  
|  
|
|  
|  
|  
|
|exp --sql sys/Cod-2022 file=x full=y|exp --sql|  
|
|exp --sql 一/1 file=x full=y|  
|  
|
|exp --sql sys/Cod-2022 file=是 tables=一.表二,表二 character_set=gbk|  
|  
|
|exp --sql 一/1 file=是 tables=一.表二,表二 character_set=gbk|  
|  
|
|  
|  
|  
|


##   [6.资料设计章节](#6资料设计章节)  

新增相关 文档描述

##   [7.未来规划](#7未来规划)  

## Attachments:

[image2024-5-30_11-25-52.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjc4OTcwYzJhZjRmNTIxNGNhIiwicmVmX2lkIjoiNjczOTZkYjc3MjgyMDZlZmI5MmYyMjcxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMDQ4LCJleHAiOjE3ODIzOTc0NDh9.yjofH9tAVoIC-WIyqCy2KzB0YUo1t0TVxUGeRFxuXPo)

 (image/png)    


## Comments:

|  [](null)  ,1、exp --csv 的 配置文件(exp.ini) 字符集 以 client/yasc_env.ini 配置的为准。,2、最终导出csv或sql的charset优先级  cmd args > exp.ini > client/yasc_env.ini。,3、不做从客户端字符集到终端字符集的显示转换。,4、打屏和日志文件的字符集以客户端字符集为准。,5、-qo 文件名 以  shell输入字符集  为准。,6、-T 文件名 以  shell输入字符集  为准。,Posted by chengkang at 七月 03, 2024 15:20|
|---|
|  [](null)  ,导出文件内容 --arg配置字符集,打屏,日志文件 --client配置字符集,shell输入 中文用户名表名, dateFormat中文年月日 – 以client配置字符集解析,shell输入 导出文件名称 – shell输入字符集，不做转换,exp.ini、queryFile解析 --client配置字符集,  
,Posted by chengkang at 七月 05, 2024 10:43|
