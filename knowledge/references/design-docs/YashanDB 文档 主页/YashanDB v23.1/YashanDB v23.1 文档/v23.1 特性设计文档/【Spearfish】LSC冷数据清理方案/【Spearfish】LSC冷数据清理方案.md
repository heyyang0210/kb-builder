Created by 梁桢灏, last modified on 一月 18, 2024

#   [LSC冷数据清理方案](#lsc冷数据清理方案)  

##   [1. Overview（概述）](#1-overview概述)  

目前，LSC冷数据由于归档模式下，SLICE即作为数据文件又作为REDO文件，因此SLICE不会被真正删除。这样归档后的SLICE在归档清理时无法清理导致磁盘无法回收，占用资源。

##   [2. Features（功能特性）](#2-features功能特性)  

LSC冷数据归档清理

##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 需要归档清理的情况：](#51-需要归档清理的情况)  

1.SLICE被COMPACT时以及删列时，会先进入GARBAGE_DATA进行延迟清理。当满足延迟清理条件，并开启归档的情况下，SLICE并不会直接删除，而是将数据转移到ARCH_CLEAN系统表中。

2.表被DROP或TRUNCATE时，会直接记录于ARCH_CLEAN 系统表中。

3.强制删除DATABUCKET时，会直接记录于ARCH_CLEAN 系统表中。(根据最终是否有时间决定是否实现）

###   [5.2 归档清理流程：](#52-归档清理流程)  

当归档清理时，会清理归档，当清理的归档的LFN大于ARCH_CLEAN 中的记录时，可以执行SLICE对应的归档清理进行SLICE文件的删除。因为记录的LFN大于等于生成SLICE的LFN，SLICE已经被归档备份，因此可删除该SLICE，该SLICE同时也发送到了备机。

但ARCH_CLEAN 系统表中记录相关可清理的信息，并且归档在各个节点都可以做自己的归档清理，因此ARCH_CLEAN 系统表中记录需要等待所有节点清理该SLICE后，已清理的全局最小LFN推了后，才可以清理该比该LFN小的记录。不然存在备机没清理，但删除系统表通过REDO已经在备机回放，导致备机无法删除该SLICE，SLICE残留。

###   [5.3异常情况](#53异常情况)  

如果备机或者级联备断联时，无法通信获取全局最小LFN，这时候归档虽然可以清理，但ARCH_CLEAN 系统表中系统表的记录不可删除，因为无法感知全部备机是否都进行归档清理到某个LFN。因此限制ARCH_CLEAN 系统表系统表的记录上限，目前假设系统表中上限为100W条记录左右（非精确值，由于并发回滚可见性等情况，可能会多一点），当ARCH_CLEAN 系统表中记录慢后，会根据最小的LFN进行系统表的槽位复用，同时主机把ARCH_CLEAN_LFN推上去，当备机发现ARCH_CLEAN_LFN小于本地的归档清理的LFN时，可正常运作，若大于时，即备机NEED REPAIR。

###   [5.4 清理时机](#54-清理时机)  

SLICE归档清理会跟随各个备机自己执行，当手动执行或自动执行时，会随着归档文件的删除进行删除SLICE文件。但由于跟随的归档清理的LFN，因此归档清理时对应的SLICE可能晚于创建SLICE的LFN进行删除。

###   [5.5 arch clean系统表](#55-arch-clean系统表)  

arch clean 系统表中，类型0为异常情况下，槽位复用，最多只有一条数据记录该复用槽位的最大lfn数值。1为table，2为slice，3为column

![](https://pingcode.yasdb.com/atlas/files/public/67396af78970c2af4f52004c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA0MjQsImV4cCI6MTc4MjMwMTIyNH0.vuSjjnBTXCY93bi9emIi3XVnrGOBfH94ZhrvfzHUE4k)

## Attachments:

[image2023-8-1_12-13-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjc4OTcwYzJhZjRmNTIwMDQ3IiwicmVmX2lkIjoiNjczOTZhZjc3MjgyMDZlZmI5MmVmZmM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDI0LCJleHAiOjE3ODIzNzY4MjR9.BPIl0yYTSKQ-4f0V-mp-HbgnnLVAMXcbV7O9aFq80CI)

 (image/png)    


[image2023-8-1_12-16-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjdhMWFkOWEzMzExZGM3ZWJjIiwicmVmX2lkIjoiNjczOTZhZjc3MjgyMDZlZmI5MmVmZmM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDI0LCJleHAiOjE3ODIzNzY4MjR9.5fon6zWsmA8sJ4PMMRVd-cqyGWlmZvWIQouWcUGpWL8)

 (image/png)    


[image2023-8-1_15-6-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjdhMWFkOWEzMzExZGM3ZWJmIiwicmVmX2lkIjoiNjczOTZhZjc3MjgyMDZlZmI5MmVmZmM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDI0LCJleHAiOjE3ODIzNzY4MjR9.441qPx0XYBYbd2wyfWzHa6sulMeutoWU6-TsG_9f434)

 (image/png)    


[image2023-8-2_16-58-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjc4OTcwYzJhZjRmNTIwMDQ4IiwicmVmX2lkIjoiNjczOTZhZjc3MjgyMDZlZmI5MmVmZmM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDI0LCJleHAiOjE3ODIzNzY4MjR9.t44E81SB15RzgaM-GBZJNULI5VUygzD_8WriVlDx4gs)

 (image/png)    


[image2023-8-2_17-7-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjc4OTcwYzJhZjRmNTIwMDQ5IiwicmVmX2lkIjoiNjczOTZhZjc3MjgyMDZlZmI5MmVmZmM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDI0LCJleHAiOjE3ODIzNzY4MjR9.7jjSC3AYbnvChAHTyNXW2AnKqf_D2lfaPyxjI_hNj7o)

 (image/png)    
