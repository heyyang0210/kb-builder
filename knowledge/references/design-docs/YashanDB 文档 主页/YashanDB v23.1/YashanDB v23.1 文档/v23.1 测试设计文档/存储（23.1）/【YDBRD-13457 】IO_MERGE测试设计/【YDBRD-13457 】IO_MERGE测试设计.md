Created by 郑荃, last modified on 一月 26, 2024

# **1. 概述**

当前YASDB刷脏页时是按照脏页在脏页队列中的顺序，将这些脏页挨个拷贝到dbwr的flush buffer中，等到buffer满或者脏页队列没有脏页时将buffer中的页面统一刷盘，每次仅写一个页面，脏页队列上的脏页是乱序的，这样写的效率很低，如果把脏页队列上物理相邻的页面合并，将这些脏页一起拷贝到buffer中，在刷盘时可以一次写入多个页面，有效提升刷盘效率

![](https://pingcode.yasdb.com/atlas/files/public/673969e8a1ad9a3311dc799d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQVFBQUFBQUVBQUFFQUFBQUFBQUFBQUFBQVFBQUJBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFJQUFBQUFBZ0FBQUFBQVFBQUFBQUFBQUFBQUFRQUFBQkFFQUFBQUFBQUFBQUFBQUFBQUFBQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk5MzQsImV4cCI6MTc4MjIyMDczNH0._j0oQ4oqhrVbBTAdH52oRkXT1ADApGd0WGrW04R7FGc)

SR:     [YDBRD-13457](https://jira.yasdb.com/browse/YDBRD-13457?src=confmacro)    -  【23.1】脏页刷盘支持IO合并  完成

开发设计：    [IO合并](/pages/createpage.action?spaceKey=YAS&title=IO%E5%90%88%E5%B9%B6)  

# **2. 需求分析**

### 配置参数：

- CKPT_NEIGHBOR_SEARCH_COUNT：  在进行脏页IO合并时需要指定寻找的neighbor个数，参数默认值为16，范围是[1,64]
- _DBWR_SORT_ENABLED：是否排序


### 脏页合并示例

假如CKPT_NEIGHBOR_SEARCH_COUNT=4，找左右邻居时，如果CKPT_NEIGHBOR_SEARCH_COUNT，中心页面算右边

1、脏页队列如下：

7-129   --->   7-128    --->  6-130   --->   7-131    --->  6-131  --->   7-132  --->   7-130  --->  6-129

- 以7-129为中心找左右邻居，找到7-127，7-128，7-129，7-130，128 129 130为脏页，从脏页队列摘下来，拷贝到flush buffe；
- 以6-130为中心找左右邻居，找到6-128，6-129，6-130，6-131，129 130 131为脏页，从脏页队列摘下来，拷贝到flush buffer；
- 以  7-131为中心找左右邻居，找到7-129，7-130，7-131，7-132,  131 132为脏页，从脏页队列摘下来，拷贝到flush buffer；


2、flush buffer:

7-128   --->   7-129   --->   7-130   --->  6-129  --->  6-130   --->  6-131  ---->   7-131   -->   7-132

3、如果要排序，按照从小到大排序，分2次刷下去，如果不排序，就按照步骤2分三次刷下去

6-129  --->  6-130     --->  6-131--->  7-128 ---> 7-129 ---> 7-130 ----> 7-131 --> 7-132

如果  CKPT_NEIGHBOR_SEARCH_COUNT=1，不排序，那还是按照原始顺序下来，但是刷盘时会有判断连续的脏页个数，一起刷下次，总共分6次刷下去

### 视图：

- v$sysstat增加统计信息项：DBWR FLUSH BLOCK COUNT(*)


![](https://pingcode.yasdb.com/atlas/files/public/673969e88970c2af4f51fb27/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQVFBQUFBQUVBQUFFQUFBQUFBQUFBQUFBQVFBQUJBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFJQUFBQUFBZ0FBQUFBQVFBQUFBQUFBQUFBQUFRQUFBQkFFQUFBQUFBQUFBQUFBQUFBQUFBQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk5MzQsImV4cCI6MTc4MjIyMDczNH0._j0oQ4oqhrVbBTAdH52oRkXT1ADApGd0WGrW04R7FGc)

- v$sysstat 已有统计项：DBWR CHECKPOINT BUFFER WRITES （  database writer执行checkpoint刷的脏页数量  ） 
- v$sysstat 已有统计项：DISK WRITES（  block刷盘总次数  ）
- DBWR CHECKPOINT BUFFER WRITES和DISK WRITES未和入特性前，两个值是相等的，和入特性后，  DBWR CHECKPOINT BUFFER WRITES>=DISK WRITES


![](https://pingcode.yasdb.com/atlas/files/public/673969e8a1ad9a3311dc799e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQVFBQUFBQUVBQUFFQUFBQUFBQUFBQUFBQVFBQUJBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFJQUFBQUFBZ0FBQUFBQVFBQUFBQUFBQUFBQUFRQUFBQkFFQUFBQUFBQUFBQUFBQUFBQUFBQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk5MzQsImV4cCI6MTc4MjIyMDczNH0._j0oQ4oqhrVbBTAdH52oRkXT1ADApGd0WGrW04R7FGc)

# **3. 测试**  **设计方法**   

部署形态：单机、分布式

测试点：

1、针对新增配置参数，采用等价类方式来进行验证，  配置参数不分单机，分布式，需要在单机和分布式上进行覆盖

2、表空间覆盖：普通表空间、加密表空间、压缩表空间

2、需要对历史功能用例、CT、KT、一致性、HA用例连跑，查看DBWR刷脏页机制优化是否会对历史功能造成影响

3、长稳环境修改配置，观测是否会有影响

4、性能：对比刷盘速度提升情况，以及tpcc性能提升情况（在快磁盘和慢磁盘下都进行验证）

- 在性能差的机械硬盘上，checkpoint性能提升80%
- 在性能好的固态硬盘上，checkpoint性能不下降
- DBWR_FLUSH_NEIGHBORS_COUNT主要覆盖1、8、32、64 和是否排序进行组合验证
- 覆盖不同表在同一个表空间、不同表创建在不同表空间


5、测试过程中结合v$sysstat的统计信息进行观测

  


观测视图：

- select value from v$sysstat where name = 'DBWR CHECKPOINT BUFFER WRITES';
- select value from v$sysstat where name = 'DISK WRITES';
- select value from v$sysstat where name like 'DBWR FLUSH NEIGHBORS COUNT%'
- v$checkpoint观测脏页的个数


测试方法：

- 把CHECKPOINT_INTERVAL和CHECKPOINT_TIMEOUT调整大，防止触发自动checkpoint
- 构造脏页队列大的时候可以把DBWR_BUFFER_SIZE调整大


# 4.   **详细测试设计**   

[DBWR_IO_MERGE.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTdhMWFkOWEzMzExZGM3OTk3IiwicmVmX2lkIjoiNjczOTY5ZTc3MjgyMDZlZmI5MmVmOGM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5OTM0LCJleHAiOjE3ODIyOTYzMzR9.yMhytjHtRFvxhEBDjNTF6AQmoR3JByCc8AlJtrVmBAg)

# 5.   **测试用例**

# 6.   **测试框架设计**

1、自动化用例添加到yasft

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[支持ROWID数据类型测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTc4OTcwYzJhZjRmNTFmYjIyIiwicmVmX2lkIjoiNjczOTY5ZTc3MjgyMDZlZmI5MmVmOGM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5OTM0LCJleHAiOjE3ODIyOTYzMzR9.RlJQx6aNVghXWPnmsgt2_C95IaT2BtKkCs991zi47_Q)

 (application/vnd.xmind.workbook)    


[image2023-4-13_16-1-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZThhMWFkOWEzMzExZGM3OTk4IiwicmVmX2lkIjoiNjczOTY5ZTc3MjgyMDZlZmI5MmVmOGM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5OTM0LCJleHAiOjE3ODIyOTYzMzR9.aGvK6fUm4lFDiG3F7XSsMNjYL2QNrfGFIEbT0OPtCDg)

 (image/png)    


[image2023-4-13_16-1-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZThhMWFkOWEzMzExZGM3OTk5IiwicmVmX2lkIjoiNjczOTY5ZTc3MjgyMDZlZmI5MmVmOGM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5OTM0LCJleHAiOjE3ODIyOTYzMzR9.22Dten9-8QJ0dY_Wb-vTkeYEMhZNh9ls2haMbhJDOxY)

 (image/png)    


[表空间透明压缩测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTg4OTcwYzJhZjRmNTFmYjI0IiwicmVmX2lkIjoiNjczOTY5ZTc3MjgyMDZlZmI5MmVmOGM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5OTM0LCJleHAiOjE3ODIyOTYzMzR9.D7yBKlEE5d9lrntGdH6G1r8MHfVMz0FT6FwvMX6SrFc)

 (application/vnd.xmind.workbook)    


[DBWR_IO_MERGE.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZThhMWFkOWEzMzExZGM3OTlhIiwicmVmX2lkIjoiNjczOTY5ZTc3MjgyMDZlZmI5MmVmOGM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5OTM0LCJleHAiOjE3ODIyOTYzMzR9.MFIeAbCDpNuMYJsGndoYblw1t5IiAxAIVEZ6KbT8a_8)

 (application/vnd.xmind.workbook)    


[DBWR_IO_MERGE.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZThhMWFkOWEzMzExZGM3OTliIiwicmVmX2lkIjoiNjczOTY5ZTc3MjgyMDZlZmI5MmVmOGM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5OTM0LCJleHAiOjE3ODIyOTYzMzR9.Hf6YWAB2NyRcLU1HITcuV7ZMyrht6qRYUvdJKqcI0mg)

 (application/vnd.xmind.workbook)    


[DBWR_IO_MERGE.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTdhMWFkOWEzMzExZGM3OTk3IiwicmVmX2lkIjoiNjczOTY5ZTc3MjgyMDZlZmI5MmVmOGM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5OTM0LCJleHAiOjE3ODIyOTYzMzR9.yMhytjHtRFvxhEBDjNTF6AQmoR3JByCc8AlJtrVmBAg)

 (application/vnd.xmind.workbook)    


[DBWR_IO_MERGE测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZThhMWFkOWEzMzExZGM3OTljIiwicmVmX2lkIjoiNjczOTY5ZTc3MjgyMDZlZmI5MmVmOGM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5OTM0LCJleHAiOjE3ODIyOTYzMzR9.4jkZI6A9IxqPKDXzksLK9Iw5YNTcfeJm8AAiW_GxWAo)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
