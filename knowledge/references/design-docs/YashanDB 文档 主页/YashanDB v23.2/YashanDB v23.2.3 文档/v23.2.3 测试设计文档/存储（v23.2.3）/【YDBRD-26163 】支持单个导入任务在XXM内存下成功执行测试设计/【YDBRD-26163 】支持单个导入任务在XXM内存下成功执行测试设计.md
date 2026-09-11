Created by 陈瑞, last modified on 六月 11, 2024

# 1. 概述

*sr：*    [https://pingcode.yasdb.com/pjm/items/6618e311fd997db58ad823f7](https://pingcode.yasdb.com/pjm/items/6618e311fd997db58ad823f7)    *?*    
  *#YDBRD-26163 支持单个导入任务在XXM内存下成功执行*

*可以精确计算出来配多大内存就能导入成功，*  *多分区，多列的场景下，导入的最小内存与列数量，分区数量无关。*

# 2. 需求分析

## 2.1 功能点分析

- 提供保证单线程导入可以成功的最小配额
- 每个线程需要的最小内存和该最小内存对应的分区规格
- 将插入的数据先写到预设的缓存（称为rgd）中，达到一定的数量后再从rgd中写入到冷数据文件中
- 最小内存：300M，后面可能下调


## 2.2 应用场景

yasldr导入+insert bulkload，  按照配置相应的  最小内存

- 10000个分区，非分区表，按照 = 最小内存配置，4096列（varchar,clob,char类型8000长度  ），分区表(包括一/二级分区) 单线程导入不报错
- 10000个分区，非分区表，按照 = 最小内存配置 * 线程数，4096列（varchar,clob,char类型8000长度  ），分区表(包括一/二级分区) 多线程导入不报错
- 调整控制导入任务  物化内存的PERCENT参数，保证按照 = 最小内存配置，导入不报错，计算公式  COLUMNAR_MATERIAL_PERCENT * COLUMNAR_VM_BUFFER_SIZE * BULKLOAD_MAX_MEM_PERCENTT
- 多个yasldr任务并发导入多表，任务数*  BULKLOAD_MAX_MEM_PERCENT  =   最小内存配置不报错
- list分区，hash分区，range(interval)分区，二级分区，其中interval 分区导入时导入数据包含新增分区    --有约束如果导入过多 新分区，可能会报错。具体出包后测试对齐


## 2.3 规格约束

- 内存不足会换入换出，但是不会报错
- 最小配额需要限制分区数量
- internal 分区 如果导入过多 新分区，可能会因为动态分配导致内存不足


# 3. 详细测试设计

## 3.1 测试设计方法

1、yasldr导入，由于限制一行最大12万字符，对于超过的使用insert bulkload导入测试。对本次给出的最小内存值计算下导入的场景覆盖。

2、按照指定内存对导入的表的数据类型，分区类型，有无唯一索引，约束覆盖，有无索引约束不作为重点，其他场景交叉覆盖即可，数据特点(有无重复值，边长)场景覆盖

## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


|测试场景|测试点|预期|
|---|---|---|
|单线程，设置为最小内存300M。insert bulkload导入|普通表，10000个hash分区，range分区，list分区，4096列（varchar,clob,char类型8000长度），导入10，1000，10000数据量，导入不报错|导入不报错|
|  
|interval分区，原range分区10个，4096列，100，1000，10000数据量，插入的新分区数10个，100个。|导入不报错|
|  
|10000二级个分区，range-hash表，4096列（varchar,clob,char类型8000长度）|导入不报错|
|多线程，  内存配置=300M * 线程数|10000个hash分区，range分区，list分区，range-range二级分区，4096列（varchar,clob,char类型8000长度）  ，  插入一级分区表单线程导入不报错|导入不报错|
|  
|导入tpch的表，线程=8，导入10万数据量数据。|导入不报错|
|  
|以上交叉覆盖带主键、AC、不带主键和AC，以及表不同的编码格式|  
|
|调整PERCENT|单线程range分区，调整参数  COLUMNAR_MATERIAL_PERCENT =50%，BULKLOAD_MAX_MEM_PERCENTT = 50%。按照COLUMNAR_MATERIAL_PERCENT * COLUMNAR_VM_BUFFER_SIZE * BULKLOAD_MAX_MEM_PERCENTT=300M,  
|导入不报错|
|  
|调整参数  COLUMNAR_MATERIAL_PERCENT =80%，BULKLOAD_MAX_MEM_PERCENTT = 80%|导入不报错|
|多个yasldr并发导入多张表。,设置  单个导入任务的  SESSION_BULKLOAD_MAX_MEM_PERCENT = 20%，内存设置300M/20%=1500M,  
|5个yasldr并发导入，并发导入200个分区的hash、list、range，二级分区，普通表五张表，导入数据10万。|导入均成功不报错|
|多个yasldr并发导入多张表。,设置  所有导入任务使用的物化内存占比,BULKLOAD_MAX_MEM_PERCENT,= 50%,SESSION_BULKLOAD_MAX_MEM_PERCENT = 20%，  COLUMNAR_VM_BUFFER_SIZE   内存设置300M/20%/50%/80%=3750M|5个yasldr并发导入，并发导入200个分区的hash、list、range，二级分区，普通表五张表，导入数据10万。|导入均成功不报错|
|_SCOL_RGD_COUNT 调整为最大值|单个导入任务|_SCOL_RGD_COUNT预期不受影响|


# 4. 测试用例

1、最小内存下

冒烟用例

  


  


# 5. 测试框架设计

- yasft
- ha_regress


# 6. 测试环境说明

*单机*

# 7. 工作量评估

工作量：  *2人天*

计划测试完成时间：06/15

## Attachments:

[image2024-6-11_9-14-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjBhMWFkOWEzMzExZGM4ZWU2IiwicmVmX2lkIjoiNjczOTZkMjA3MjgyMDZlZmI5MmYxYjcwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MDU2LCJleHAiOjE3ODIzOTI0NTZ9.5X-MuJowkSgEEGZqAzp1Nyzs-K7ZAuoHk8lrQll999o)

 (image/png)    


[最小内存冒烟.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjBhMWFkOWEzMzExZGM4ZWU3IiwicmVmX2lkIjoiNjczOTZkMjA3MjgyMDZlZmI5MmYxYjcwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MDU2LCJleHAiOjE3ODIzOTI0NTZ9.9DC6FtLoUj88na-3-0Wzo0aaJEcqaFDPqM8rdDaaeug)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
