Created by 高亚宁, last modified by  陈瑞 on 九月 18, 2023

## 1.   **概述**

-   [1. 概述](#id-【YDBRD16397】yasrman支持XBSA和客户端模式测试设计-1.概述)  
-   [2. 需求分析  ](#id-【YDBRD16397】yasrman支持XBSA和客户端模式测试设计-2.需求分析)  
    -   [2.1 SR：【rman】yasrman支持XBSA和客户端模式](#id-【YDBRD16397】yasrman支持XBSA和客户端模式测试设计-2.1SR：【rman】yasrman支持XBSA和客户端模式)  
    -   [2.2 备份语法：](#id-【YDBRD16397】yasrman支持XBSA和客户端模式测试设计-2.2备份语法：)  
    -   [2.3 恢复语法：](#id-【YDBRD16397】yasrman支持XBSA和客户端模式测试设计-2.3恢复语法：)  
    -   [2.4 流式备份和yasrman远程备份的区别](#id-【YDBRD16397】yasrman支持XBSA和客户端模式测试设计-2.4流式备份和yasrman远程备份的区别)  
-   [3. 测试设计方法 ](#id-【YDBRD16397】yasrman支持XBSA和客户端模式测试设计-3.测试设计方法)  
    -   [3.1 特性关联领域分析：](#id-【YDBRD16397】yasrman支持XBSA和客户端模式测试设计-3.1特性关联领域分析：)  
    -   [3.2 测试设计：](#id-【YDBRD16397】yasrman支持XBSA和客户端模式测试设计-3.2测试设计：)  
-   [4. 详细测试设计   ](#id-【YDBRD16397】yasrman支持XBSA和客户端模式测试设计-4.详细测试设计)  
    -   [4.1  语法部分](#id-【YDBRD16397】yasrman支持XBSA和客户端模式测试设计-4.1语法部分)  
    -   [4.2  流式备份、恢复功能](#id-【YDBRD16397】yasrman支持XBSA和客户端模式测试设计-4.2流式备份、恢复功能)  


本文描述yasrman支持XBSA和客户端模式的测试设计

## 2.   **需求分析**

### 2.1 SR：【rman】yasrman支持XBSA和客户端模式

链接：    [YDBRD-16397](https://jira.yasdb.com/browse/YDBRD-16397?src=confmacro)    -  【rman】yasrman支持XBSA和客户端模式  完成

设计文档：    [流式备份API - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=112729495)      


场 景：  yasrman适配第三方XBSA接口，实现远程流式备份

需求规格：

1. yasrman指令添加parms="XBSA_LIBRARY=/home/yasdb/    [libxbsa.so](http://libxbsa.so)    , ENV=(key1=val1,key2=val3,....)"，加载指定的xbsa库，并传入外部参数
1. 流式备份支持增量备份，全量备份，支持压缩，加密，并行度


功能限制：暂不支持OM备份工具yasbak

### **2.2 备份**  **语法：**

  `yasrman <user>/<password>@<host>:<port> -c <command> [-D <catalog_path>]`      


![](https://pingcode.yasdb.com/atlas/files/public/673969f58970c2af4f51fb54/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFFQUFBQUFBQ0FBQUFBQUFBQ0FBQWdBQUFBQVFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBU0FBQUlBRUFBQUFBQUFBQUVBQUFBQUNBQUFBQUFBUUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQ0FCQUFBQWdBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTAzODgsImV4cCI6MTc4MjIyMTE4OH0.an6kFHmtmvcdYyXaLBvgrihrbrOTzdU9vZg5ZjQmTS0)

  
    
  **dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so/)    **, TOKEN=157257815837, ENV=(key1=val1,key2=val2)'**     其中ENV内的参数列表由鼎甲提供

**参数说明：**

**format: **  备份集路径——流式备份不要设置format指定备份路径，仅需要设置tag，默认备份在catalog/backup目录

**tag：**  TAG为备份集别名，最大长度64（包含结束符'\0'）

**parallelism：**  并行度，范围[1, 8]，默认是2

**SECTION SIZE：**  指定文件分片大小，超过该值的文件会被拆分为多个小文件执行备份，范围[128M, 32T], 默认为自动计算的最优值（暂不支持）

**COMPRESSION：**  指定压缩算法

**ENCRYPTION：**  指定加密算法

**DEST：**  指定备份集的存储位置，client表示存储到工具端，server表示备份到数据库主机端。不指定时默认为server

**params：**  指定    [xbsa.so](http://xbsa.so)    的路径，token，和xbsa所需的参数，目前token和参数在模拟器内不起作用，可以随便设置

示例：

1. 全量备份：yasrman sys/Cod-2022@127.0.0.1:1601 -c "backup database tag 'bak_full_10' parallelism 4     **dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so/)    **, TOKEN=157257815837, ENV=(key1=val1,key2=val2)'**  " -D catalog路径
1. 增量备份：
    1. yasrman sys/Cod-2022@127.0.0.1:1601 -c "backup database incremental level 0 tag 'bak_incr_0'    **dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so/)    **, TOKEN=157257815837, ENV=(key1=val1,key2=val2)'**  " -D catalog路径
    1. yasrman sys/Cod-2022@127.0.0.1:1601 -c "backup database incremental level 1 tag 'bak_incr_1'   **dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so/)    **, TOKEN=157257815837, ENV=(key1=val1,key2=val2)'**  " -D catalog路径
1. 恢复：
    1. 先清理数据库残留文件，启动到nomount
    1. yasrman sys/Cod-2022@127.0.0.1:1601 -c "restore database from tag 'bak_incr_1'   **dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so/)    **, TOKEN=157257815837, ENV=(key1=val1,key2=val2)'**  " -D catalog路径


### **2.3 恢复语法：**

![](https://pingcode.yasdb.com/atlas/files/public/673969f58970c2af4f51fb55/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFFQUFBQUFBQ0FBQUFBQUFBQ0FBQWdBQUFBQVFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBU0FBQUlBRUFBQUFBQUFBQUVBQUFBQUNBQUFBQUFBUUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQ0FCQUFBQWdBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTAzODgsImV4cCI6MTc4MjIyMTE4OH0.an6kFHmtmvcdYyXaLBvgrihrbrOTzdU9vZg5ZjQmTS0)

**dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so/)    **, TOKEN=157257815837, ENV=(key1=val1,key2=val2)'**  其中ENV内的参数列表由鼎甲提供

### 2.4 流式备份和yasrman远程备份的区别

yasrman远程备份：  基于tcp的远程备份，yasrman工具作为接收端

![](https://pingcode.yasdb.com/atlas/files/public/673969f5a1ad9a3311dc79cb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFFQUFBQUFBQ0FBQUFBQUFBQ0FBQWdBQUFBQVFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBU0FBQUlBRUFBQUFBQUFBQUVBQUFBQUNBQUFBQUFBUUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQ0FCQUFBQWdBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTAzODgsImV4cCI6MTc4MjIyMTE4OH0.an6kFHmtmvcdYyXaLBvgrihrbrOTzdU9vZg5ZjQmTS0)

流式备份：

1. 鼎甲的备份server调用yasbak工具（OM开发，不在该SR中测试），下发备份、恢复命令
1. yasrman工具（部署在备份服务器）加载第三方    [libxbsa.so](http://libxbsa.so)    动态库
1. 数据库进程和yasrman采用tcp通信传输数据，yasrman完成备份后，通过XBSA接口转发给备份服务器


  


![](https://pingcode.yasdb.com/atlas/files/public/673969f5a1ad9a3311dc79cc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFFQUFBQUFBQ0FBQUFBQUFBQ0FBQWdBQUFBQVFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBU0FBQUlBRUFBQUFBQUFBQUVBQUFBQUNBQUFBQUFBUUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQ0FCQUFBQWdBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTAzODgsImV4cCI6MTc4MjIyMTE4OH0.an6kFHmtmvcdYyXaLBvgrihrbrOTzdU9vZg5ZjQmTS0)

## 3.   **测试设计方法**   

### 3.1 特性关联领域分析：

1. 部署形态：分机部署工具侧和数据库侧——先部署一主2备，拆分成3个单机，1个作为工具侧，2个作为数据库侧
1. 流式备份、恢复语法部分：dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/    [libxbsa.so](http://libxbsa.so/)    , TOKEN=157257815837, ENV=(key1=val1,key2=val2)'部分单独测试
1. 功能：全量、增量、差量备份，使用备份集恢复数据库
1. 梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点


|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|是|
|HA|/|
|压力|  
|
|性能|是|
|可维护性|  
|
|资料|是|


### 3.2 测试设计：

主要采用  场景法和错误推测法进行设计

## 4.   **详细测试设计**

### 4.1  语法部分

|  
|测试场景|有效等价类|无效等级类|备注|
|:---|:---|---|---|:---|
|1|备份语法|语法正确|不写dest client|yasrman sys/Cod-2022@127.0.0.1:1601 -c "backup database tag 'bak_full_10' parallelism 4     **dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so/)    **, TOKEN=157257815837, ENV=(key1=val1,key2=val2)'**  " -D catalog路径|
|2|  
|指定format路径，备份成功，但指定的路径无效|  
|  
|
|3|  
|不写params 'XBSA_LIBRARY=/home/mzh/install/lib/    [libxbsa.so](http://libxbsa.so/)    , TOKEN=157257815837, ENV=(key1=val1,key2=val2)'|写params 'XBSA_LIBRARY=/home/mzh/install/lib/    [libxbsa.so](http://libxbsa.so/)    , TOKEN=157257815837, ENV=(key1=val1,key2=val2)'，但是XBSA_LIBRARY路径不存在|  
|
|4|  
|  
|XBSA_LIBRARY参数缺失，  yasrman sys/Cod-2022@127.0.0.1:1601 -c "backup database tag 'bak_full_10' parallelism 4     **dest client params 'TOKEN=157257815837, ENV=(key1=val1,key2=val2)'**  " -D catalog路径|  
|
|5|  
|  
|TOKEN参数缺失，  yasrman sys/Cod-2022@127.0.0.1:1601 -c "backup database tag 'bak_full_10' parallelism 4     **dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so/)    **, ENV=(key1=val1,key2=val2)'**  " -D catalog路径|  
|
|6|  
|  
|ENV缺失，  yasrman sys/Cod-2022@127.0.0.1:1601 -c "backup database tag 'bak_full_10' parallelism 4     **dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so/)    **,ENV=(key1=val1,key2=val2)'**  " -D catalog路径|  
|
|7|  
|ENV中的key值缺失或者只有一个，yasrman sys/Cod-2022@127.0.0.1:1601 -c "backup database tag 'bak_full_10' parallelism 4     **dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so/)    **, TOKEN=157257815837, ENV=(key2=val2)'**  " -D catalog路径|  
|  
|
|8|  
|XBSA_LIBRARY，TOKEN，ENV大小写混合、XBSA_LIBRARY长度为255，TOKEN 长度为63，ENV的子参数个数为10|XBSA_LIBRARY长度256|1. XBSA_LIBRARY,等3个单词 不区分大小写    
  2. XBSA_LIBRARY最大长度255    
  3. TOKEN 最大长度63    
  4. ENV的子参数个数没限制，总长度小于4096|
|9|  
|  
|TOKEN 长度64|  
|
|10|  
|  
|ENV的子参数个数有很多个，长度大于4096|  
|
|11|恢复语法|恢复语法正确|不写dest client|yasrman sys/Cod-2022@127.0.0.1:1601 -c "restore database from tag 'bak_incr_1'   **dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so/)    **, TOKEN=157257815837, ENV=(key1=val1,key2=val2)'**  " -D catalog路径|
|12|  
|  
|不写params 'XBSA_LIBRARY=/home/mzh/install/lib/    [libxbsa.so](http://libxbsa.so/)    , TOKEN=157257815837, ENV=(key1=val1,key2=val2)'|  
|
|13|  
|  
|写params 'XBSA_LIBRARY=/home/mzh/install/lib/    [libxbsa.so](http://libxbsa.so/)    , TOKEN=157257815837, ENV=(key1=val1,key2=val2)'，但是XBSA_LIBRARY路径不存在|  
|
|14|  
|  
|XBSA_LIBRARY参数缺失，  yasrman sys/Cod-2022@127.0.0.1:1601 -c "restore     database from tag 'bak_full_10' parallelism 4     **dest client params 'TOKEN=157257815837, ENV=(key1=val1,key2=val2)'**  " -D catalog路径|  
|
|15|  
|  
|TOKEN参数缺失，  yasrman sys/Cod-2022@127.0.0.1:1601 -c "restore     database from tag 'bak_full_10' parallelism 4     **dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so/)    **, ENV=(key1=val1,key2=val2)'**  " -D catalog路径|  
|
|16|  
|  
|ENV缺失，  yasrman sys/Cod-2022@127.0.0.1:1601 -c "restore     database from tag 'bak_full_10' parallelism 4     **dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so/)    **,ENV=(key1=val1,key2=val2)'**  " -D catalog路径|  
|
|17|  
|  
|ENV中的key值缺失或者只有一个，yasrman sys/Cod-2022@127.0.0.1:1601 -c "restore     database from tag 'bak_full_10' parallelism 4     **dest client params 'XBSA_LIBRARY=/home/mzh/install/lib/**    [libxbsa.so](http://libxbsa.so/)    **, TOKEN=157257815837, ENV=(key2=val2)'**  " -D catalog路径|  
|
|18|yasrman config|  
|yasrman config params 'TOKEN=157257815837, ENV=(key1=val1,key2=val2)',，报错|  
|


### 4.2  流式备份、恢复功能

|  
|测试场景|用例详细描述|预期|备注|
|:---|:---|---|---|:---|
|1|备份|使用流式备份语法，做全量备份（简单语法）|备份成功|...backup database full dest client...|
|2|  
|使用流式备份语法，做level 0 的增量备份，带所有备份属性，查看dba_backup_set中的属性|备份成功，备份集属性于备份语句中一致|  
|
|3|  
|使用流式备份语法，做level 1 的增量备份，带所有备份属性，查看dba_backup_set中的属性|备份成功|  
|
|4|  
|使用流式备份语法，做level 1 的差量备份，带所有备份属性，查看dba_backup_set中的属性|备份成功|  
|
|5|  
|使用yasrman config语法，配置备份属性，使用流式备份语法做备份，查看dba_backup_set中的属性|备份成功，备份集属性与配置的一致|```
yasrman sys/sys@127.0.0.1:1688 <span class="token parameter variable" style="color: rgb(126,198,153);">-c
</span> <span class="token string" style="color: rgb(126,198,153);">'configure PARALLELISM 3'</span> <span class="token parameter variable" style="color: rgb(126,198,153);">-D</span> /home/yashan/catalog
```|
|6|恢复|使用上面备份成功的备份集，恢复数据，校验数据量|恢复成功，数据量正确|  
|
|7|备份集查看|复用现有用例，dest client的备份恢复语句改成流式备份的|  
|  
|
|8|备份集删除|复用现有用例，dest client的备份恢复语句改成流式备份的|  
|  
|
|9|并发|连接2个不同的库，同时做流式备份|备份成功|  
|
|10|  
|连接同一个库，同时做流式备份|后执行的备份报错|  
|
|11|  
|连接2个不同的库，同时做流式恢复|恢复成功|  
|
|12|  
|连接同一个库，同时做流式恢复|后执行的恢复报错|  
|
|13|异常场景|复用现有yasrman的用例，dest client的备份恢复语句改成流式备份的|  
|  [ha/testcase/ha_schedule_backup/backup_yasrman · master · CoD-X / anchor_test · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/anchor_test/-/tree/master/ha/testcase/ha_schedule_backup/backup_yasrman)  ,  [anchor_dfr/src/test/resource/test_tp_ha_yasrman.py · master · CoD-X / Yastest Dfx · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/yastest_dfx/-/blob/master/anchor_dfr/src/test/resource/test_tp_ha_yasrman.py)  |
|14|大数据量|全量备份数据库，TPCC load 1000仓数据，做增量备份、恢复|增量备份成功、恢复成功|  
|
|15|性能|加上参数后，跑现有备份恢复工程|备份恢复性能不下降|  [master_L3_sa_perf_Backup_Restore [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/gaoyaning/my-views/view/ha_L3_perf/job/master_L3_sa_perf_Backup_Restore/)  ,  [流式备份性能测试记录 - 陈瑞 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=130127361)  ,  
|


## Attachments:

[image2023-6-1_9-22-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjU4OTcwYzJhZjRmNTFmYjUyIiwicmVmX2lkIjoiNjczOTY5ZjU3MjgyMDZlZmI5MmVmOTQ2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMzg4LCJleHAiOjE3ODIyOTY3ODh9.JC4uWLxBuz1De_8DJ3fSVc2nw2xE5NhkjKyNvBNaqHE)

 (image/png)    


## Comments:

|  [](null)  ,测试策略：,1. 新增场景单独写用例测试
1. 其他yasrman中已有的功能，比如说异常场景，需要重新测试？
,Posted by gaoyaning at 七月 19, 2023 10:30|
|---|
