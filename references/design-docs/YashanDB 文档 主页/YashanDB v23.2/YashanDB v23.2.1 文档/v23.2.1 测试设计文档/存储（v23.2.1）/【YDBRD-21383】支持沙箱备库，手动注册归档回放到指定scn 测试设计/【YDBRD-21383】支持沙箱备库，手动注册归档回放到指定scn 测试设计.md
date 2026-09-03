Created by 郑荃, last modified on 十一月 21, 2023

# 1.   **概述**

归档日志注册是将已归档的日志文件信息记录到数据库的控制文件中的过程。它的主要用途如下：

1. 归档日志注册对于数据库的恢复非常重要。通过实时记录归档日志文件的信息，数据库可以使用这些归档日志文件来还原数据并恢复到崩溃点之后的状态。在发生灾难或故障导致数据丢失时，归档日志的注册能够确保数据的完整性。
1. 在进行离线备份（例如冷备份）时，通过手动注册归档日志文件，备份还原过程可以使用这些归档日志文件来保证数据库在备份点之后的一致性。这对于满足恢复时间目标（RTO）和恢复点目标（RPO）非常关键。
1. 通过手动注册归档日志文件，可以实现恢复到指定的时间点，也就是时间点恢复。这对于执行精确的数据恢复非常有用，特别是在需要还原到特定时间点之前的数据状态时。


备库回放：

- 为了能对任意一个时期的数据库当中的数据进行读取、分析以及挖掘，我们需要一个在不阻碍数据库正常访问的情况下的备库。该备库数据继承主数据库，可通过备份库、归档文件恢复。该库恢复后，在OPEN状态下，通过SQL语句操作备库实现回放到相对于备机SCN到主机SCN当中的任意一个时间。


# 2.   **需求分析**

**需求SR:**    [YDBRD-21383](https://jira.yasdb.com/browse/YDBRD-21383?src=confmacro)    **-**  **【23.2】支持沙箱备库，手动注册归档回放到指定scn**  **完成**

**设计文档：**

  [备机注册归档](124266008.html)  

  [沙箱备库回放](124262526.html)  

### 2.1 备机注册归档

![](https://conf.yasdb.com/download/attachments/124266008/image2023-8-17_17-6-28.png?version=1&modificationDate=1692263054000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTc3NjIsImV4cCI6MTc4MjMwODU2Mn0.9ENfVdDHEgJTMTuuOaqEc_wDTqlks1LGabqDmWhYqdE)

- v$archived_log新增字段表示注册方式
- 新增配置参数SANDBOX_STANDBY来开启沙箱备机。取值范围/格式：TRUE，FALSE，默认值：FALSE。 修改立即生效：否    会话级参数：否   只读参数：否


  


功能特征：

- 沙箱备机支持手动注册归档
- 可以单个注册，也可以批量注册
- 支持结合PITR使用，即restore后可以手动注册归档，实现恢复到指定时间点。
- PITR优化：1、备机支持指定的scn回放，且不需要resetlogs。2、指定的scn过大，报错告知用户
- 日志切换优化：主机切完日志，备机快速同步切换


  


功能限制：

1. mount和open阶段可以注册归档
1. 完整数据库，仅限沙箱备机注册归档
1. 同一个asn的归档只能注册一个，不能出现多个rst不一致，asn相同的归档存在
1. 沙箱备机拒绝主机的连接
1. 注册个数无上限，为sql语句上限32K


注册校验：

1. 只校验头部的checksum校验，数据不做校验。
1. 校验database_id
1. asn的归档已经存在，如果是sql语句带OR REPLACE，则覆盖已经注册的归档(该操作比较危险，容易导致归档丢失，谨慎使用)，否则需要报错
1. 只允许注册一个相同asn的归档
1. 归档格式校验？（后续支持不同实例的归档）


在线日志处理：

1. 注册归档，发现当前归档等于current redo，就把current redo reset 掉，不做初始化。


### 2.2 备机回放

  


|功能|设计表现|设计说明|
|:---|:---|:---|
|回放暂停|暂停成功 / 暂停失败，异常 / 回放未开始|在备机回放子程序执行时进行临时暂停操作|
|回放继续|继续成功 / 继续失败，异常 / 回放已经开始|在备机回放子程序暂停/未开始时进行继续/启动操作|
|回放到指定scn|执行开始 / 正在执行中 / 创建执行失败|这个模块是回放继续到指定位置SCN|
|回放状态视图|显示出当前回放状态|在回放过程中可实时监视情况|


### SQL语法设计

#### 回放暂停SQL语法

```
<span class="hljs-keyword">alter</span> <span class="hljs-keyword">database</span> <span class="hljs-keyword">recover</span> <span class="hljs-keyword">managed</span> <span class="hljs-keyword">standby</span> <span class="hljs-keyword">database</span> <span class="hljs-keyword">cancel</span>;

```

#### 回放继续SQL语法

- 后台开启回放线程


```
<span class="hljs-keyword">alter</span> <span class="hljs-keyword">database</span> <span class="hljs-keyword">recover</span> <span class="hljs-keyword">managed</span> <span class="hljs-keyword">standby</span> <span class="hljs-keyword">database</span> <span class="hljs-keyword">disconnect</span> <span class="hljs-keyword">from</span> <span class="hljs-keyword">session</span>;

```

- 前台开启回放线程


```
<span class="hljs-keyword">alter</span> <span class="hljs-keyword">database</span> <span class="hljs-keyword">recover</span> <span class="hljs-keyword">managed</span> <span class="hljs-keyword">standby</span> <span class="hljs-keyword">database</span>;

```

#### 回放到指定scn的SQL语法

```
<span class="hljs-keyword">alter</span> <span class="hljs-keyword">database</span> <span class="hljs-keyword">recover</span> <span class="hljs-keyword">managed</span> <span class="hljs-keyword">standby</span> <span class="hljs-keyword">database</span> <span class="hljs-keyword">until</span> <span class="hljs-keyword">SCN</span> &lt;<span class="hljs-keyword">SCN</span>&gt;

```

  ``    **新增视图：v$recovery_status**

  


- 这个视图显示备机归档回放状态
- 线程数 当前回放状态 并行回放子线程数量 开始回放时间 停止回放时间 回放的起始点
- THREAD# STATUS PARALLELISM START_RECOVERY_TIME STOP_RECOVERY_TIME REPLAY_POINT


  


  
    
  3.   **测试设计方法**

### 3.1 特性关联领域分析：

1、部署形态：采用一主2备部署，拆分成一主一备+一沙盘备机

2、测试过程中结合     v$database、v$archived_log观测scn，新增v$recovery_stats视图查看当前的一个回放状态，  v$archived_log新增字段表示注册方式

3、新增配置参数，对配置参数的默认值，有效值无效值，生效方式等进行验证

4、使用注册的归档来进行pitr恢复

5、沙箱备机增加增量restore功能验证

6、集群不支持，需要做拦截测试

  


### 3.2 测试设计：

1、针对注册归档和备机回放的语法验证，主要采用  等价类划分，边界值

2、针对功能采用场景法组合及错误推测法进行设计

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

[沙箱备机.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTc4OTcwYzJhZjRmNTIwN2YwIiwicmVmX2lkIjoiNjczOTZiZTc1OTNmOTljOWZmMjM2ODFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NzYyLCJleHAiOjE3ODIzODQxNjJ9.j6oFTjH8fGX2H1ZtQUu3rIWi0m33hbsKtlQARIi9ucw)

2）专项

|专项|是否涉及|
|:---|:---|
|并发|涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR/testkill|涉及|
|HA|涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|
|资料|涉及|


  


# 5.   **测试用例**

测试设计细化后的文本用例

# 6.   **测试框架设计**

使用已有的ha_regress测试框架

  [https://git.yasdb.com/cod-x/anchor_regress/-/tree/master/ha_regress](https://git.yasdb.com/cod-x/anchor_regress/-/tree/master/ha_regress)  

# 7.   **测试环境说明**

使用linux操作系统安装yashan， 对于环境配置无要求

  


## Attachments:

[沙箱备机.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTc4OTcwYzJhZjRmNTIwN2YwIiwicmVmX2lkIjoiNjczOTZiZTc1OTNmOTljOWZmMjM2ODFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NzYyLCJleHAiOjE3ODIzODQxNjJ9.j6oFTjH8fGX2H1ZtQUu3rIWi0m33hbsKtlQARIi9ucw)

 (application/vnd.xmind.workbook)    


[沙箱备机测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTdhMWFkOWEzMzExZGM4NjYyIiwicmVmX2lkIjoiNjczOTZiZTc1OTNmOTljOWZmMjM2ODFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NzYyLCJleHAiOjE3ODIzODQxNjJ9.LiNO8n_52d-V__k26yTBNtcDftC115UJ8nWFJW0mbIg)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[沙箱备机测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTdhMWFkOWEzMzExZGM4NjYzIiwicmVmX2lkIjoiNjczOTZiZTc1OTNmOTljOWZmMjM2ODFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NzYyLCJleHAiOjE3ODIzODQxNjJ9.gu2VQAbIq2ke7ZZtp2CGkAz6_cDFIau-AeTCpxTc5Tc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2023-11-21_16-32-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTc4OTcwYzJhZjRmNTIwN2YxIiwicmVmX2lkIjoiNjczOTZiZTc1OTNmOTljOWZmMjM2ODFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NzYyLCJleHAiOjE3ODIzODQxNjJ9.yJcbFZ12mRvpvT4sehol8P1h_F1ZuG8mc-le8hcuH7U)

 (image/png)    


[image2023-11-21_16-33-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTdhMWFkOWEzMzExZGM4NjY0IiwicmVmX2lkIjoiNjczOTZiZTc1OTNmOTljOWZmMjM2ODFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NzYyLCJleHAiOjE3ODIzODQxNjJ9.cgxpLLEcx9sO1FnARzFOkEQPZ2A2fZkxwmHngPpTHlo)

 (image/png)    


[image2023-11-21_16-34-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTc4OTcwYzJhZjRmNTIwN2YzIiwicmVmX2lkIjoiNjczOTZiZTc1OTNmOTljOWZmMjM2ODFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NzYyLCJleHAiOjE3ODIzODQxNjJ9.5-1S9bM-La_3J9_xFCKgt2h7pj-JUbDqvnqTpgtNZlI)

 (image/png)    


## Comments:

|  [](null)  ,RTO：  恢复时间目标 (RTO) 是指在出现中断或发生问题后，可用于恢复资源的最长时间,RPO：  恢复点目标 (RPO) 是指数据库应该恢复到的时间点,ASN: 归档序列号，archive sequence number,每产生一个redo，asn会加1，每个redo的asn不相同,lfn：log flush number，日志序列号，每次redo刷盘，lfn加1。,rst：为reset id，每次failover后，数据库新产生的redo文件的reset id会加1。,Posted by zhengquan at 十月 16, 2023 18:30|
|---|
