Created by 刘大境, last modified on 三月 21, 2024

# **1. 概述**

给指定的一级分区添加多个二级分区(hash分区只能添加一个)，能够shrink指定的一级分区和二级分区

**SR:**    [[YDBRD-15283] 二级分区支持Modify Partition - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-15283)  

开发设计：    [MODIFY PARTITION/SUBPARTITION - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=115148633)  

# **2.需求分析**

1.指定添加的range二级分区的bound需要递增并且首个分区要大于该一级分区下的最后一个分区

2.指定添加的list 二级分区的bound不能有重复

3.指定添加的二级分区类型需要和表的二级分区类型一致

4.若有local索引，创建的二级分区索引默认为usable

# **3.测试设计方法**

(1) 主要采用场景法和错误推算法及边界测试法进行设计

1.涉及9种不同二级分区组合正交测试法

2.只支持heap表，LSC/TAC拦截

3.修改不存在及add分区属性

4.批量modify partition/subpatition 1、2级分区，表/索引

# **4.**  **详细测试设计**

|测试场景|用例详细描述|分类|无效类|
|:---|:---|:---|:---|
|三种二级分区类型hash/range/list 不带values|modify partition p1 add subpartition+分区名|1. modify partition p1 add subpartition 带values
1. add 多个subpartition 带values
1. add 多个subpartition 不带values
1. 先insert 后add subpartition
1. 先建索引 后add subpartition   
1. 后建索引 后add subpartition
1. 创建local索引，观测分区索引是否未usable
1. partition p1/p2  subpartition分区数不相等 做insert
1. 外键分区表
1. 1M-1分区 add supartition
1. 长稳的用例 不断加supartition
1. 带模板/不带模板
1. 一个一级分区只有一个二级分区 add supartition
1. 带lob数据
1. partition/subpartition视图  index视图
|modify subpartition p2 add subpartition+分区名,hash二级分区下指定   add  ≥    subpartition 报错|
|shrink space|modify partition p1 shrink space,modify subpartition p2 shrink space|1.存储空间不足 执行shrink space (单个分区),2.带/不带索引 shrink space,4. seesion 1做大数据insert，seesion 2 shrink space|modify partition shrink space,modify subpartition shrink space,同时shrink space指定1/2级分区|
|三种二级分区类型hash/range/list|  
|1.只有range二级分区可递增values ,2.重复values (二级分区list/range 不能带重复values),3.add partition/shrink space 带DML操作|1.非递增values  ,2.小于该一级分区下最后一个分区values,  
|
|指定添加的二级分区类型与表二级分区类型一致|该二级分区为range,alter table hr_composite modify partition p1 add subpartition s1 values less than(160);|1.以上分类会覆盖|指定添加的二级分区类型与表二级分区类型不一致|
|add subpartition搭配回收站,  
|三种二级分区类型hash/range/list,1.开启回收站 建表+add subpartition+大数据insert+truncate table 或者truncate 分区/drop table或者drop分区+flashback|drop partition不支持flashback  拦截验证|  
|
|列表|add supartition ( 支持LSC,TAC),shrink partiotion (拦截),shrink supartition（拦截)|TAC带索引|备注:  等列存二级分区上车后，需要重新rebase下列存的代码出包验证一下，目前转测包暂未包含列表代码|
|并发场景|前置：表空间+建hash/list/range二级分区表,过程体: insert+shrink space+modify partition  p1 add partition/subpartition+drop/truncate subpartition 带查询,后置:删表+删表空间| 两两组合并发|  
|
|  
|前置：表空间+建hash/list/range二级分区表,insert+shrink space+modify partition  p1 add partition/subpartition+带索引+update+ 带查询|  
|  
|
|HA场景|1.主机建二级分区表 插数据,3.modify,4.备机查询,5.主备switchover,6.新主机shrink space,7.备机查询,8.主备failover,9.主机add subpartition 再insert 备机查询,10.清理环境|  
|  
|


# 5.   **测试框架设计**

自动化用例添加到YAT框架以及HA框架

# 6.   **测试用例**

  


# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


## Attachments:

[image2023-7-10_14-40-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmI4OTcwYzJhZjRmNTFmYjY2IiwicmVmX2lkIjoiNjczOTY5ZmI3MjgyMDZlZmI5MmVmOTc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTUyLCJleHAiOjE3ODIyOTY5NTJ9.f1L6ELgC5-WxFpDIvqJZWKEXjC1VmrxxKxtQAmrWDIA)

 (image/png)    


[image2023-7-10_17-21-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmJhMWFkOWEzMzExZGM3OWRkIiwicmVmX2lkIjoiNjczOTY5ZmI3MjgyMDZlZmI5MmVmOTc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTUyLCJleHAiOjE3ODIyOTY5NTJ9.RDkCMzXMXjU9oIbfqov14nSp6XixO08y-1vhEoqKjZs)

 (image/png)    


[image2023-7-25_9-57-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmJhMWFkOWEzMzExZGM3OWRlIiwicmVmX2lkIjoiNjczOTY5ZmI3MjgyMDZlZmI5MmVmOTc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTUyLCJleHAiOjE3ODIyOTY5NTJ9.BApK6cbo2CGw_BgcjhMHdWiIIC35N-rdOHGtktfQumU)

 (image/png)    


[image2023-7-25_19-44-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmI4OTcwYzJhZjRmNTFmYjY3IiwicmVmX2lkIjoiNjczOTY5ZmI3MjgyMDZlZmI5MmVmOTc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTUyLCJleHAiOjE3ODIyOTY5NTJ9.Otw4jiwryPkTMAIcr5YfctcwSCP2hNGFOxEnO6eLBBs)

 (image/png)    


[image2023-7-25_19-45-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmI4OTcwYzJhZjRmNTFmYjY4IiwicmVmX2lkIjoiNjczOTY5ZmI3MjgyMDZlZmI5MmVmOTc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTUyLCJleHAiOjE3ODIyOTY5NTJ9.hXLiAJ9i0Dx4EGuNUSznc3BV62deYN2-If8ayBsy4JA)

 (image/png)    


[二级分区支持modify partition文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmJhMWFkOWEzMzExZGM3OWRmIiwicmVmX2lkIjoiNjczOTY5ZmI3MjgyMDZlZmI5MmVmOTc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTUyLCJleHAiOjE3ODIyOTY5NTJ9.NUQ22CjIuJ7wPt9XNgsAsq0ejaSd9rxwwTxGk1gzUK0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
