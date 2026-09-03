Created by 易文亮, last modified on 十月 13, 2023

# **1. 概述**

本文描述LSC表slice延迟清理的测试设计

# **2. 需求分析**

SR：        [YDBRD-11787](https://jira.yasdb.com/browse/YDBRD-11787?src=confmacro)    -  【2023.1】LSC表的稳态数据后台按Slice清理  完成

开发设计：    [【Spearfish】LSC延迟清理SLICE](122077533.html)    、涉及的其他相关描述：    [延迟清理数据提前清理](https://conf.yasdb.com/pages/viewpage.action?pageId=126746787)  

语法验证：

ALTER TABLE table_name ALTER SLICE ALL { STABLE | COMPACT | CLEAN  [ ASYNC ] };

ALTER SYSTEM SET DATA_TRANSFORMER_ENABLED={TRUE|FALSE} scope={BOTH|SPFILE|MEMORY}

ALTER TABLE table_name {ENABLE|DISABLE} { TRANSFORM | COMPACT | BUILD AC }

功能验证：

1、slice动态转静态会产生废弃slice(vgd)

2、slice合并会产生废弃slice

3、slice删除和部分删除触发合并会产生废弃slice

4、alter drop列，slice中的列数据废弃

5、分区表下的废弃slice产生

6、带AC的lsc表，进行slice合并时会产生废弃AC slice

7、关闭后台转换开关时slice的清理验证

注：考虑手工立即清理和自动延迟清理机制验证，考虑开归档和不开归档slice延迟清理的差异验证

其他测试点：

1、并发过程中强制合并

2、slice清理+合并+dml并发

3、大slice清理，验证最大slice

4、大量slice清理

5、主备同步

相关视图：

v$lsc_slice_stat

garbage_data$（type 0-vgd,1-slice,3-slice列）

arch_data$

  


# **3. 测试**  **设计方法**   

测试设计主要采用等价类测试法进行设计

# 4.   **详细测试设计**

4.1 功能验证

|**前置条件**|**测试内容1**|**测试过程1**|**验证点1**|**测试内容2**|**测试过程2**|**验证点2**|
|---|---|---|---|---|---|---|
|不开归档|废弃vgd构造|slice转换：手工转换/后台自动转换|*走slice延迟清理机制*  ：废弃slice(列)记录进garbage_data$|执行手工立即清理命令,  
,  
,  
  等待后台延迟清理|手工清理：ALTER TABLE table_name ALTER SLICE ALL  CLEAN;,  
,  
  自动清理：,后台任务开关：DATA_TRANSFORMER_ENABLE为true    
  文件清理时延：DATA_RETENTION设置为0/无限小|清空garbage_data$，删除废弃slice，  生命周期结束|
||废弃slice构造|slice合并：手工合并/后台自动合并    
  构造多个slice进行合并    
  delete掉slice部分数据/整个slice触发合并|||||
||废弃slice列构造|带静态slice的表alter table drop 列|||||
||废弃ac slice构造|带ac含静态数据的表合并、delete、update(AC失效数据重新生成)|||||
|开归档|废弃vgd构造|slice转换：手工转换/后台自动转换|*走slice延迟清理机制*  ：废弃slice(列)记录进garbage_data$|执行手工立即清理命令,  
,  
  等待后台延迟清理|手工清理：ALTER TABLE table_name ALTER SLICE ALL  CLEAN;,  
  自动清理：,后台任务开关：DATA_TRANSFORMER_ENABLE为true    
  文件清理时延：DATA_RETENTION设置为0/无限小|清空garbage_data$，删除废弃slice，  生命周期结束|
||废弃slice构造|slice合并：手工合并/后台自动合并    
  构造多个slice进行合并    
  delete掉slice部分数据/整个slice触发合并||||清空garbage_data$，记录到arch_data$，  *走归档清理机制*|
||废弃slice列构造|带静态slice的表alter table drop 列|||||
||废弃ac slice构造|带ac含静态数据的表合并、delete、update(AC失效数据重新生成)|||||


  `后台任务时延：_DATA_TRANSFORMER_SCHEDULING_TIME`  

4.2 组合场景

|序号|测试场景|测试预期|
|---|---|---|
|1|DATA_TRANSFORMER_ENABLE关闭确认后台自动清理|不会自动清理|
|2|DATA_TRANSFORMER_ENABLE关闭执行手工立即清理|能正常清理|
|3|1个/多个vgd转换确认手工立即清理/后台自动清理机制|机制正确|
|4|2个/多个slice合并确认手工立即清理/后台自动清理机制|机制正确|
|5|alter drop单列(首列、中间列、尾列)/多列、lob列确认清理机制|机制正确|
|6|反复构造slice、反复合并清理确认清理机制|机制正确|
|7|带AC的表delete/update/合并后确认手工立即清理/后台自动清理机制|机制正确|
|8|开启归档验证上述过程，确认手工立即清理/后台自动清理机制|机制正确|
|9|增列后对新增列插数转换后alter drop确认清理机制|机制正确|
|10|alter drop空的新增列|机制正确|
|11|并发打开/关闭开关+清理|不死锁|
|12|并发转换、合并、清理|功能正常|
|13|HA slice清理备机回放|功能正常|


  


# 5.   **测试用例**

[LSC支持稳态数据后台按slice清理(ydbrd11787).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTRhMWFkOWEzMzExZGM3OTkxIiwicmVmX2lkIjoiNjczOTY5ZTQ1OTNmOTljOWZmMjM1M2U4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Nzk2LCJleHAiOjE3ODIyOTYxOTZ9.utxbj9LPdag_pnMbwEEk9NQJyKASqrqhT9SuGkjc_ds)

[YDBRD11787静态slice清理测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTQ4OTcwYzJhZjRmNTFmYjFiIiwicmVmX2lkIjoiNjczOTY5ZTQ1OTNmOTljOWZmMjM1M2U4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Nzk2LCJleHAiOjE3ODIyOTYxOTZ9.nc7mT-zJ-9-_ja42CMrjDPD2xTzqVkTi2QRMkc9ng9k)

# 6.   **测试框架设计**

自动化用例添加到YAT框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机+分布式|


## Attachments:

[LSC支持稳态数据后台按slice清理(ydbrd11787).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTRhMWFkOWEzMzExZGM3OTkxIiwicmVmX2lkIjoiNjczOTY5ZTQ1OTNmOTljOWZmMjM1M2U4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Nzk2LCJleHAiOjE3ODIyOTYxOTZ9.utxbj9LPdag_pnMbwEEk9NQJyKASqrqhT9SuGkjc_ds)

 (application/x-xmind)    


[YDBRD11787静态slice清理测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTQ4OTcwYzJhZjRmNTFmYjFiIiwicmVmX2lkIjoiNjczOTY5ZTQ1OTNmOTljOWZmMjM1M2U4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5Nzk2LCJleHAiOjE3ODIyOTYxOTZ9.nc7mT-zJ-9-_ja42CMrjDPD2xTzqVkTi2QRMkc9ng9k)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,思考：slice为什么要清理？不清理有什么影响或者危害？为什么要延迟清理？,Posted by yiwenliang at 十月 12, 2023 11:32|
|---|
