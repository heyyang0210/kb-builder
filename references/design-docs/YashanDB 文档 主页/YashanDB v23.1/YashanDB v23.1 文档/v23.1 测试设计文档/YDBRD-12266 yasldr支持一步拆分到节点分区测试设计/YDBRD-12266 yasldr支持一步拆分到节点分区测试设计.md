Created by 陈钦卿 on 十一月 14, 2023

# 1. 概述

SR:      [YDBRD-12266](https://jira.yasdb.com/browse/YDBRD-12266?src=confmacro)    -  yasldr支持一步拆分到节点分区  完成

开发设计：    [csv 文件拆分设计文档 - 蔡思南 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=100099467)  

  


**部署形态：**

（1）分布式

# 2. 需求分析

## 2.1 功能点分析

目前只支持单文件单表的操作

               1）单文件单表单分区



               2）单文件单表多分区           

                    将原来的一个csv文件按照表的分区划分分成n个分区文件，文件的命名目前按照分区号0，1，2..来命名

场景： 分为单机和分布式，对于单机使用分区键进行划分，对于分布式使用分布键进行划分。

  


1、增加一个token: directory, 用来设置csv拆分后的输出文件存放的目录，如果不指定，将以INFILE的给出的第一个文件的目录作为输出文件的目录

![](https://pingcode.yasdb.com/atlas/files/public/67396970a1ad9a3311dc769b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDT0VBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjc1NzEsImV4cCI6MTc4MjEzODM3MX0.8FMnF54M8fofU3YY-XcIUbGocugoZ_RoGpcE6wN6wDg)

  


![](https://pingcode.yasdb.com/atlas/files/public/673969708970c2af4f51f823/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDT0VBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjc1NzEsImV4cCI6MTc4MjEzODM3MX0.8FMnF54M8fofU3YY-XcIUbGocugoZ_RoGpcE6wN6wDg)

2、增加一个options： run_level

      文件拆分目前有两种run_level: SPLIT和SPLIT_TO_PART

-       如果指定run_level = SPLIT : 对于  单机  环境，会按照分区键进行拆分，最终生成的文件放在directory指定的路径或者infile的第一个文件所在的文件夹下；


                                                             对于  分布式  环境，会按照分布键进行拆分，最终生成的文件放在directory指定的路径或者infile的第一个文件所在的文件夹下；

-        如果指定run_level = SPLIT_TO_PART： 如果此时是单机环境，会按照SPLIT模式下的单机方式进行拆分；


                                                                                如果此时是分布式环境，但是创建的表格是  非分区表  ， 会按照SPLIT模式下的分布式模式进行拆分；

                                                                                如果此时分布式环境，但是创建的表格是  多分区  ，最终会在directory指定的路径或者infile所在的第一个文件所在的文件夹下，生成以节点ip：端口号命名的文件夹，并在该文件夹下生成按照分区拆分的文件。

## 2.2 规格约束

- 只支持单表的csv文件拆分， 不支持  多表的  csv文件拆分，对于多表的拆分报错。客户端只支持单文件不支持多文件
- 如果在sql语句中指定了输出文件“DICETORY”目录，但是并没有指定  run_level = split ，会报错
- 暂时不支持动态分区的csv文件拆分
- 不支持服务端
- 不同的csv文件，一个以， ， 一个以| 为分隔符，拆分完之后可能会出现一个分区文件多种不同分隔符的场景。目前对于分区文件的命名是否要加上原先的csv文件的一些属性，或者交给用户判断    
  这个是用户的错误行为，需要用户自己规避  。


  


# 3. 详细测试设计

## 3.1 测试设计方法

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

## 3.2 详细测试设计

[一步拆分到节点分区测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzA4OTcwYzJhZjRmNTFmODIyIiwicmVmX2lkIjoiNjczOTY5NzA3MjgyMDZlZmI5MmVmMzZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NTcxLCJleHAiOjE3ODIyMTM5NzF9.KB85yLroRVAMnDuZbWBp8wQDyCjeyzC3eCdM21ZFWrg)

#   
  4. 测试用例

#   
  5. 测试框架设计

本次测试采用exp_imp_test测试框架实现，执行py文件，对比期望结果与输出结果，输出测试结果。

# 6. 测试环境说明

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机、分布式|


# 7.工作量评估

工作量：人天

计划测试完成时间：

## Attachments:

[一步拆分到节点分区测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzA4OTcwYzJhZjRmNTFmODIyIiwicmVmX2lkIjoiNjczOTY5NzA3MjgyMDZlZmI5MmVmMzZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NTcxLCJleHAiOjE3ODIyMTM5NzF9.KB85yLroRVAMnDuZbWBp8wQDyCjeyzC3eCdM21ZFWrg)

 (application/x-xmind)    
