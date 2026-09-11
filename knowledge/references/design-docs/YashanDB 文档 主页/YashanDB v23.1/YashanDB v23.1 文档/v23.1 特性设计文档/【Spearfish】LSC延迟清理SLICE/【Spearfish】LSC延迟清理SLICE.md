Created by 梁桢灏, last modified on 一月 18, 2024

#   [LSC延迟清理SLICE](#lsc延迟清理slice)  

##   [1. Overview（概述）](#1-overview概述)  

目前，LSC热数据通过延迟删除的方式减少出现查询时数据从热转冷的情况，而冷数据在全部数据删除以及COMPACT后，原SLICE文件仍然保留未删除，因此需要延迟删除冷数据来释放空间，并且减少查询时SLICE被删除导致的报错。

##   [2. Features（功能特性）](#2-features功能特性)  

LSC冷数据延迟清理

##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

归档模式下，SLICE延迟清理不支持，由归档清理进行清理。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 LSC冷数据删除场景](#51-lsc冷数据删除场景)  

冷数据目前需要清理的场景：

- 1.COMPACT后的SLICE文件。
- 2.删列后列的SLICE清理。


####   [5.1.1 SLICE清除。](#511-slice清除)  

SLICE通过COMPACT时，可知那个SLICE需要进行清理，因此在COMPACT完成后添加进DATA_GARBAGE系统表进行延迟清理。同理删列也相同，记录下需要删除的列信息，等待清除时间进行清理。

####   [5.1.2 SLICE删除](#512-slice删除)  

当触发SLICE清理的时间时，会通过DATA_GARBAGE系统表进行清理。清理不记录REDO，因为这时候默认SLICE已经可以被清理，删除失败情况下删除可重做，无需保证。归档情况下，SLICE不会被清理，由归档清理进行清理。

####   [5.1.3 SLICE清理时机](#513-slice清理时机)  

SLICE清理可以由配置项控制时间进行清理，也可以手动触发清理。在未删表前，SLICE清理由系统表进行控制清理。删表时，VGD把清理记录记录于SEG_GARBAGE系统表，提交后清理，而DATA_GARBAGE系统表SLICE无事务保证，立马清理。因此如果ROLLBACK时可能就删除了。因此在删表时会输出DATA_GARBAGE中的SLICE相关记录，但不会删除SLICE文件，删除SLICE文件提交后释放SEGMENT时进行表级别的文件删除。

##   [6. 测试用例](#6-测试用例)  

##   [7. Document（资料）](#7-document资料)  

##   [8. Workload（工作量）](#8-workload工作量)  

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

## Attachments:

[image2023-8-1_12-16-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjhhMWFkOWEzMzExZGM3ZWM1IiwicmVmX2lkIjoiNjczOTZhZjg1OTNmOTljOWZmMjM1YmNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDM1LCJleHAiOjE3ODIzNzY4MzV9.8h1OVoWP_tvugu3NWMmwxuZsdH2HZpnGEQRLFrCjrls)

 (image/png)    


[image2023-8-1_15-6-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjg4OTcwYzJhZjRmNTIwMDRmIiwicmVmX2lkIjoiNjczOTZhZjg1OTNmOTljOWZmMjM1YmNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDM1LCJleHAiOjE3ODIzNzY4MzV9.WNhaES3FOgP9VD5HwvXFDiAh2qlsAE1NdsIaG_66lwQ)

 (image/png)    


[image2023-8-2_17-7-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjg4OTcwYzJhZjRmNTIwMDUxIiwicmVmX2lkIjoiNjczOTZhZjg1OTNmOTljOWZmMjM1YmNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDM1LCJleHAiOjE3ODIzNzY4MzV9.VbC8ZOqyARzWsc48DveSk2DrNOxBVs-cQlCBh2ANeBQ)

 (image/png)    
