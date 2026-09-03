Created by 易文亮, last modified on 五月 25, 2023

# **1. 概述**

本文描述LSC表静态slice后台会自动compact合并的测试设计

# **2. 需求分析**

SR：        [YDBRD-11786](https://jira.yasdb.com/browse/YDBRD-11786?src=confmacro)    -  【2023.1】LSC表的稳态数据后台按切片进行排序及合并  完成

开发设计：    [【SpearFish】LSC表的稳态数据后台按Slice Compact - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=104233133)  

语法验证：

手工语法 ALTER TABLE table_name ALTER SLICE ALL { STABLE | COMPACT | CLEAN     [](109585647.html)    [   ASYNC   ] };  

全局xfmr后台任务开关   ALTER   SYSTEM SET DATA_TRANSFORMER_ENABLE={TRUE|FALSE} scope={BOTH|SPFILE|MEMORY}

单表后台任务开关   ALTER TABLE table_name {ENABLE|DISABLE} { TRANSFORM | COMPACT | CLEAN | BUILD AC }

功能验证：

1、COMPACT规则验证(自动compact和手工强制compact)：

      按slice文件编号顺序合并，排序，不超过  _SCOL_SLICE_ROWS的1/2位则会尝试合并，覆盖带AC，覆盖LOB场景

2、全局开关验证

3、单表开关验证

其他测试点：

1、  compact任务也持久化存在tabxfmr$系统表中，标识的type为4；

2、  compact任务结束后删除的源slice对应的ac slice会无效，需重新生成AC slice；

3、后台可能compact多次，手工合并得到最终结果，  ASYNC为异步标识，任务进入后台处理，不带ASYNC则任务完成后返回；

4、删除配置  _COLUMNAR_SLICE_SORT_ROWS、_DATA_TRANSFORMERS,配置项_COLUMNAR_SLICE_ROWS改名为_MCOL_SLICE_ROWS，新增配置项_SCOL_SLICE_ROWS用于标识slice上限，只能小改大，默认8M；

5、v$lsc_slice_stat增加compact字段；

# **3. 测试**  **设计方法**   

测试设计主要采用场景法、等价类及错误推测等测试法进行设计

[LSC支持稳态数据后台合并(ydbrd11786).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTNhMWFkOWEzMzExZGM3OThmIiwicmVmX2lkIjoiNjczOTY5ZTM1OTNmOTljOWZmMjM1M2U0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NzU5LCJleHAiOjE3ODIyOTYxNTl9.cAEv74-QzNnMH0o5nbXtPIsqLafyxY-l_sMUtu_m6Y8)

  


# 4.   **详细测试设计**

4.1 基础语法验证

|**输入条件**|**语句ALTER TABLE table_name**|**有效等价类**|**编号**|**无效等价类**|**编号**|**备注**|
|:---|:---|:---|:---|:---|:---|:---|
|  
,普通表lsc,range分区,hash分区,list分区,interval分区| 手动任务ALTER SLICE ALL|STABLE转换    
  COMPACT合并    
  CLEAN清理,  
|1,2,3|1、同时带多个关键字,2、关键字重复,3、关键字拼写错误|11|  
|
|||带ASYNC,不带ASYNC|8,9|1、关键字重复,2、关键字拼写错误|  
|  
|
||开关{ENABLE|DISABLE}|STABLE转换,COMPACT合并    
  CLEAN清理    
  BUILD AC,  
|4,5,6,7|1、同时带多个关键字,2、关键字重复,3、关键字拼写错误|12|  
|


4.2 合并规则验证

1）手工合并规则

2）后台自动合并规则

  


4.3 配置项验证

1）_COLUMNAR_SLICE_ROWS重命名为_MCOL_SLICE_ROWS，范围内可随意调整，默认值：，范围：；

2）新增SCOL_SLICE_ROWS，只能调大，默认值：，范围：；

3）新增DATA_TRANSFORMER_ENABLE，bool值，scope={BOTH|SPFILE|MEMORY}

4）删除_COLUMNAR_SLICE_SORT_ROWS和_DATA_TRANSFORMERS

  


4.4 其他功能验证

1）大量小的slice合并

2）大文件合并

4.5 并发验证

1）insert+select+后台自动合并

2）insert+select+手工合并/转换

3）insert+select+手工合并/转换+单表合并/转换开关

# 5.   **测试用例**

[YDBRD11786静态slice合并测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTNhMWFkOWEzMzExZGM3OTkwIiwicmVmX2lkIjoiNjczOTY5ZTM1OTNmOTljOWZmMjM1M2U0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NzU5LCJleHAiOjE3ODIyOTYxNTl9.88Bz1emvmNDHwCzNGavkM322fq3hkuR3LhIArj3Ryco)

# 6.   **测试框架设计**

自动化用例添加到YAT框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|分布式+单机|


## Attachments:

[LSC支持稳态数据后台合并(ydbrd11786).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTNhMWFkOWEzMzExZGM3OThmIiwicmVmX2lkIjoiNjczOTY5ZTM1OTNmOTljOWZmMjM1M2U0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NzU5LCJleHAiOjE3ODIyOTYxNTl9.cAEv74-QzNnMH0o5nbXtPIsqLafyxY-l_sMUtu_m6Y8)

 (application/x-xmind)    


[YDBRD11786静态slice合并测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTNhMWFkOWEzMzExZGM3OTkwIiwicmVmX2lkIjoiNjczOTY5ZTM1OTNmOTljOWZmMjM1M2U0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NzU5LCJleHAiOjE3ODIyOTYxNTl9.88Bz1emvmNDHwCzNGavkM322fq3hkuR3LhIArj3Ryco)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
