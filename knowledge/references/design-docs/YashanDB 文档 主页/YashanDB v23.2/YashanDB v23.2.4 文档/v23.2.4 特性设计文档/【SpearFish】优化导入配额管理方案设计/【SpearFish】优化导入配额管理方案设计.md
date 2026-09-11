Created by 黄文早, last modified on 七月 22, 2024

# YDBRD-26595 : 优化导入配额管理方案设计

SR链接：    [https://pingcode.yasdb.com/pjm/items/6627136cfd997db58adf4662](https://pingcode.yasdb.com/pjm/items/6627136cfd997db58adf4662)    ?

## 1. Overview（概述）

   导入最小内存合入后，保证了最小内存场景下，导入不会报错，但是没有充分验证存在换入换出场景下，导入性能是否达标。因此需要使用合理的算法，控制导入过程中的内存使用，提升内存不足的导入性能。

并且增加三层用例，确定导入内存不足时的性能基线。

## 2. Features（功能特性）

   性能优化需求无对外特性展示

##  3. Interfaces（接口）

无

## 4. Specification And Constraints（规格与约束）

   无

## 5. Detail Design（详细设计）

#### 5.1 优化点：提前分配部分writer

        问题原因：当前版本提前分配一个slice writer 的，rgd buffer 最多可用70% 的内存，并且导入时，先写rgd buffer，可能导致生成的writer 少，从导致刷盘速度成为瓶颈，阻塞前台写入。 

        优化方案：预分配部分 coast writer。  预分配coast writer 数量：hash 表导入尝试分配每个分区一个writer，直到writer 配额达到上限(80%)。（48分区表，16个转换线程，初始化32个writer 导入速度明显小于48分区，48分区用时38s，32 writer用时120s）

 range/list 分区，也只分配一个writer，当首次需要生成writer时，遍历分区，如果多个分区内都写入数据，按有数据的分区数量生成writer。

#### 5.2 优化提交刷盘顺序

       当前版本，数据提交时按顺序提交，如果当前rgd 无writer ，则等待一个有writer的rgd 完成刷盘，容易造成单线程刷盘。

优化：先将所有有writer 的rgd 刷盘。

#### 5.3 优化顺序导入内存使用

        多分区导入时，如果数据是按分区顺序导入的，当部分分区导入完成后，才会导入其他分区，完成导入的分区需要今早刷盘，释放出内存提供给后续导入的分区。

可以根据导入数据统计当前分区的优先级，使用lru 算法，淘汰满足行数超过SCOL_SLICE_ROWS/32 行数，并且导入次数最少的分区,  将该分区 的内存转移到需要内存的分区。

![](https://pingcode.yasdb.com/atlas/files/public/67396dca8970c2af4f521540/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQWtBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFFQUVBQVFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQVFBQUJDQUFBZ0FBQUFJQUFBQUFBQUFBQUVBQUFFQUFnQUFCQUFBQUFBQUFBQkFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTE3MzQsImV4cCI6MTc4MjMyMjUzNH0.RmLkjC6GUOt8S86Ahk513o8K4M1EoxVb94-jlm7xsmY)

#### 5.4 优化number 编码

   number 编码在存在换入换出时，容易导致cpu 性能瓶颈

![](https://pingcode.yasdb.com/atlas/files/public/67396dcaa1ad9a3311dc93b2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQWtBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFFQUVBQVFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQVFBQUJDQUFBZ0FBQUFJQUFBQUFBQUFBQUVBQUFFQUFnQUFCQUFBQUFBQUFBQkFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTE3MzQsImV4cCI6MTc4MjMyMjUzNH0.RmLkjC6GUOt8S86Ahk513o8K4M1EoxVb94-jlm7xsmY)

  


原因：number 编码在存在换入换出时，未进行批量处理，导致产生大量小io，修复之后

![](https://pingcode.yasdb.com/atlas/files/public/67396dcaa1ad9a3311dc93b3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQWtBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFFQUVBQVFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQVFBQUJDQUFBZ0FBQUFJQUFBQUFBQUFBQUVBQUFFQUFnQUFCQUFBQUFBQUFBQkFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTE3MzQsImV4cCI6MTc4MjMyMjUzNH0.RmLkjC6GUOt8S86Ahk513o8K4M1EoxVb94-jlm7xsmY)

  


以下结果依次为hash 分区导入无优化，优化writer 数量，优化number 编码后的内存-速度曲线

  


![](https://pingcode.yasdb.com/atlas/files/public/67396dca8970c2af4f521541/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQWtBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFFQUVBQVFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQVFBQUJDQUFBZ0FBQUFJQUFBQUFBQUFBQUVBQUFFQUFnQUFCQUFBQUFBQUFBQkFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTE3MzQsImV4cCI6MTc4MjMyMjUzNH0.RmLkjC6GUOt8S86Ahk513o8K4M1EoxVb94-jlm7xsmY)

### 5.3 Compatibility（兼容性）

   兼容性不相关

### 5.4 DFX设计

1. 考虑增加隐藏配置项，控制导入writer 预先创建的最大数量。
1.  bulkload session 视图增加，目前考虑增加：writer 配额与rgd配额，空闲配额大小 三个列。


## 6. Testcases（自测用例）

   1.   添加三层导入性能工程，添加性能看护用例。

   2.   不影响当前三层导入用例性能

用例：100G tpch 数据，128分区，不同内存配置下测试导入性能

hash 分区： 数据不做切分

range 分区：数据按分区切分导入与不按分区切分导入都测

与不同内存配置正交。

测试多任务下性能瓶颈

## 7.资料设计章节

不涉及资料修改

## 8. TODO（遗留问题）

无

## Attachments:

[image2024-7-19_11-28-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkY2FhMWFkOWEzMzExZGM5M2FmIiwicmVmX2lkIjoiNjczOTZkY2E1OTNmOTljOWZmMjM3ZmI5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExNzM0LCJleHAiOjE3ODIzOTgxMzR9.hvnLqW_O9S4Vz-dmZmAXBJ8Cbzwiwq-JL4FvOhHQS3Y)

 (image/png)    


[image-20240719093549714.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkY2FhMWFkOWEzMzExZGM5M2IwIiwicmVmX2lkIjoiNjczOTZkY2E1OTNmOTljOWZmMjM3ZmI5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExNzM0LCJleHAiOjE3ODIzOTgxMzR9.tf3ll3PvRHEgP0IPCwgLzyCsgC0FbPQyBmWhZlcniIs)

 (image/png)    


[image2024-7-19_11-28-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkY2E4OTcwYzJhZjRmNTIxNTNlIiwicmVmX2lkIjoiNjczOTZkY2E1OTNmOTljOWZmMjM3ZmI5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExNzM0LCJleHAiOjE3ODIzOTgxMzR9.M8TwbfynEIvdMPaZcOtFsYqQQXZV0G060BN-Rwp58Ec)

 (image/png)    


## Comments:

|  [](null)  ,空闲配额大小 由 导入quota 减去 writer quota 和rgd quota 可以计算出，不增加列统计,Posted by huangwenzao at 七月 31, 2024 17:37|
|---|
