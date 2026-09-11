Created by 张地强, last modified by  施新华 on 十一月 14, 2023

# 1.   **概述**

分布式table相关DDL改造，去除distribute by，  改造现有分布表，支持分布表可以有大于数据节点个数的分片数

# 2.   **需求分析**

  [YDBRD-6410](https://jira.yasdb.com/browse/YDBRD-6410?src=confmacro)    **-**  **支持基于数据空间管理的table相关DDL**  **完成**

  [YDBRD-6410 支持基于数据空间管理的table相关DDL - 何阳 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119547996)  

需求主要涉及建表语法的修改，包括去除  distributed by语法，修改partition用法，兼容subpartition语法，指定chunk数，新增  CONSISTENT     HASH  等

### 2.1 功能分析

1.分布式下Sharded表，至少是一级分区表，一级分区表的个数跟chunk个数一致

2.无distributed by以及partition by关键词 --- 把缺省信息补齐，但是这个会变成一个分区表

3.无distributed by，有partition by — 分布键会变成分区键

4.distributed by，partition by --- 报错

5.distributed by，无 partition by --- 报错

6.不支持的语法，需要报错 （边界条件，规格限制里面的场景）

7.无partition by，有subpartition — 报错

8.有partition by，有subpartition — 成功 （二级分区支持，range，hash，list，模板和非模板）

### 2.2 约束

1. 分布式一级分区只支持hash分区，不支持range，list以及interval分区
1. 分布式下不支持一级分区的增删操作
1. 分布式下不支持指定匿名的一级分区数，一级分区数默认跟chunk个数一致
1. 分布式下指定的一级分区名的个数，需要跟所属tablespace set的chunk数一样，否则会报错
1. 根据DS_SCALE_OUT这个配置参数，如果DS_SCALE_OUT != 1，则不支持distributed by的语法
1. 分布式不支持一级分区指定特定tablespace，语法解析不会报错，校验上会报错
1. 分布式下二级分区不能指定特定tablespace，语法解析不会报错，校验上会报错


# 3.   **测试设计方法**

场景法：包括构造不同分区场景

边界值法：包括分区数、chunk数等相关边界

等价类法：包括表类型、分区类型等

# 4.   **详细测试设计**

[YDBRD-6410 支持基于数据空间管理的table相关DDL.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NmNhMWFkOWEzMzExZGM3Njc4IiwicmVmX2lkIjoiNjczOTY5NmM3MjgyMDZlZmI5MmVmMzMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NDA3LCJleHAiOjE3ODIyMTM4MDd9.lESVJkXwvlMGSeeDCUtSt8id-TnVbp8BywNteir8IUw)

# 5.   **测试用例**

  [distribution/testcase/DDL_01/change_distrubute_to_partition · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/DDL_01/change_distrubute_to_partition)  

# 6.   **测试框架设计**

复用yasft测试框架

# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments:

[YDBRD-6410 支持基于数据空间管理的table相关DDL.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NmNhMWFkOWEzMzExZGM3Njc4IiwicmVmX2lkIjoiNjczOTY5NmM3MjgyMDZlZmI5MmVmMzMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NDA3LCJleHAiOjE3ODIyMTM4MDd9.lESVJkXwvlMGSeeDCUtSt8id-TnVbp8BywNteir8IUw)

 (application/x-xmind)    
