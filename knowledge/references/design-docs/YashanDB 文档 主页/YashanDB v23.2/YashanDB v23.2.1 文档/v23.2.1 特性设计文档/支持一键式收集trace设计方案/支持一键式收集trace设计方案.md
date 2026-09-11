Created by 刘顺鹏, last modified on 一月 22, 2024

## 1. OverView（概述）

  [YDBRD-25039](https://jira.yasdb.com/browse/YDBRD-25039?src=confmacro)    -  【OM】支持一键式收集trace  完成

目标为collection all 命令可以收集trace等信息。

由于cluster log命令已经支持收集trace，所以本方案直接把cluster log集成到collection all。

## 2. Feature（功能特性）

1. 执行collection all 命令时带上 --cluster-log参数，在执行collection all时收集trace等信息。


## 3. Interfaces （接口）

collection all 命令新增三个参数：

|长参|短参|含义|类型|限制或说明|
|---|---|---|---|---|
|--cluster-log|-cl|收集包含trace在内的集群信息|bool|默认为false，不收集|
|--cluster-log-start|-cls|cluster log 收集的起始时间，例如,'2006-01-02', '15\\:04\\:05', '2006-01-02 15\\:04\\:05'|string|可以不填，默认为当天0点|
|--cluster-log-end|-cle|cluster log 收集的终止时间，例如,'2006-01-02', '15\\:04\\:05', '2006-01-02 15\\:04\\:05'|string|可以不填，默认为当前时间|
|--force|-f|无需确认起始时间和终止时间是否符合预期再继续|bool|默认false|


  


  


## 4. Specification And Constraints（规格与约束）

无

  


  


## 5. Detail Design（详细设计）

### 在执行 yasboot collection all时，假如--cluster-log 参数为true，yasboot 会通过传入的消息构造  YasdbLog 结构体，执行它的execute 函数(相当于调用一次 yasboot cluster log 命令)，下载trace信息。

![](https://pingcode.yasdb.com/atlas/files/public/67396c86a1ad9a3311dc8afd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUFBQUVBQUFBQUNBQUFBQUFBQVFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDEzMjYsImV4cCI6MTc4MjMxMjEyNn0.UzJK9HieSEvCQ7ovwSXAlndo951G1kjldcOY5fmd-do)

## 6. Testcases（自测用例）

上述相关yasboot命令可以正常执行。

## 7. Document（资料）

## 8. Workload（工作量）

## 9. TODO（遗留问题）

## Attachments:

## Comments:

|  [](null)  ,cluster log 收集添加 yasdb.ini,Posted by liushunpeng at 一月 16, 2024 15:34|
|---|
