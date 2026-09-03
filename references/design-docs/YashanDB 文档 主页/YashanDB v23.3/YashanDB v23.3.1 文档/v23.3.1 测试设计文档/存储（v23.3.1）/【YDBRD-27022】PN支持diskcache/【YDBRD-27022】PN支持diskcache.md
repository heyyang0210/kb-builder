Created by 刘丹, last modified by  郑荃 on 十月 18, 2024

# 1. 概述

IR:       [YASHAN-2861](https://pingcode.yasdb.com/ship/ideas/66279d35009f91eb87f67bcc)       -- 分布式支持PN上的diskcache

SR:       [YDBRD-27022](https://pingcode.yasdb.com/pjm/items/663f40aa288e197820895a96)       -- PN支持diskcache

此设计方案包含对于diskcache支持目录缓存的设计。

在现有实现中， diskcache 假定其后端存储机制为 tablespace，因此产生了较高耦合度的代码。在存算分离项目中新增的Pn节点类型不包含任何tablespace，因此无法原生使用 diskcache。

此设计方案计划将diskcache实现抽象化，剥离出原有基于tablespace的实现，并添加基于文件目录的新的实现。另外，在所有场景下，改用文件目录实现，并将原有tablespace实现作为死代码暂存。

# 2. 需求分析

## 2.1 功能点分析

1. 需要看是否有diskccache文件夹生成
1. 支持  DISKCACHE_ROOT参数相对路径修改


## 2.2 应用场景

存算分离场景，lsc 分布表

## 2.3 规格约束

- 设计不考虑用户使用挂载点干扰文件目录结构：若用户自定义挂载点，不保证一定能使用到 diskcache 。
- 当前 FsDevice 对于       `alloc/free`       的粒度为文件级，而对于       `write/read`       的粒度为块级。
- 修改       `DISKCACHE_FS_ROOT`       配置项将会重建 diskcache ，原有缓存数据将会丢失，但不会影响到上游原始数据。
- 修改       `DISKCACHE_FS_CAPACITY`       配置项低于当前已占用空间时会在当前会话中逐步淘汰已缓存数据。
- 当 diskcache 内部出现错误（例如出现文件不可读写等报错）时，用户不应感知 diskcache 错误：
    - 查询时数据库遇到 diskcache 错误应尝试从源头拉取数据。
- 为避免单台机器上多个节点 diskcache 路径冲突，       `DISKCACHE_FS_ROOT`       推荐为节点相对路径（不以       `/`       开头）
    - 若确实是绝对路径，需要告警，但仍然设置成功
- 用户不允许添加名字为 cache 的 databucket


## 2.4 部署模式

分布式，分布式HA

# 3. 详细测试设计

## 3.1 测试设计方法

- 参数设置语法：边界值分析法，等价类划分，路径覆盖
- 不同参数组合+不同表类型+不同数据量：场景覆盖法


## 3.2 详细测试设计

[YDBRD-27022_PN支持diskcache(1).emmx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOGM4OTcwYzJhZjRmNTIxOTQ5IiwicmVmX2lkIjoiNjczOTZlOGM3MjgyMDZlZmI5MmYyOTQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3ODg0LCJleHAiOjE3ODI1MjQyODR9.-7GgAg9fS00J1QAZDm90N4SWloIwExgig1rTHZhNPgM)

# 4. 测试用例

冒烟文本用例：

文本用例：  lsx

# 5. 测试框架设计

Guider需要支持部署存算分离架构。

# 6. 测试环境说明

部署：分布式

# 7. 工作量评估

工作量：14  *人天*

计划测试完成时间：2024/4/24

## Attachments:

[YDBRD-27023_分布式支持PN上LSC元数据缓存.emmx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOGNhMWFkOWEzMzExZGM5N2JkIiwicmVmX2lkIjoiNjczOTZlOGM3MjgyMDZlZmI5MmYyOTQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3ODg0LCJleHAiOjE3ODI1MjQyODR9.xj0JXWFvIeLnaZwnY4pbeL3RkaQqbAdL3Ko-yGYbVh4)

 (application/octet-stream)    


[YDBRD-27022_PN支持diskcache(1).emmx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOGM4OTcwYzJhZjRmNTIxOTQ5IiwicmVmX2lkIjoiNjczOTZlOGM3MjgyMDZlZmI5MmYyOTQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3ODg0LCJleHAiOjE3ODI1MjQyODR9.-7GgAg9fS00J1QAZDm90N4SWloIwExgig1rTHZhNPgM)

 (application/octet-stream)    
