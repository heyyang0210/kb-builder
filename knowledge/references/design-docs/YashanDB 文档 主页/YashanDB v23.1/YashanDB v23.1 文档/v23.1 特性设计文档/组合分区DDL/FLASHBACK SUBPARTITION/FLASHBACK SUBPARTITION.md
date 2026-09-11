Created by 江祉涵, last modified on 七月 07, 2023

###   [一、功能](#一功能)  

- 能够闪回指定的二级分区表的分区和子分区


###   [二、语法树](#二语法树)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b418970c2af4f52031a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTIzNzksImV4cCI6MTc4MjMwMzE3OX0.64gtXtTmI2YKgras5-3xCssvX2eNeVaVhyQlwgMMyiY)

  


  


  


###   [三、测试用例](#三测试用例)  

  


|二级分区类型|测试用例|输出结果|
|---|---|---|
|hh|flashback table hh_composite partition p1 to before truncate;,flashback table hh_composite subpartition p1_sub1 to before truncate;,flashback table hh_composite to before truncate;,  
|成功,成功,成功|
|hr|||
|hl|||
|rh|||
|rr|||
|rl|||
|lh|||
|lr|||
|ll|||
|||
|||
|||
|||


## Attachments:

[modify_partition.GIF](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDE4OTcwYzJhZjRmNTIwMzE2IiwicmVmX2lkIjoiNjczOTZiNDE1OTNmOTljOWZmMjM2MDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyMzc5LCJleHAiOjE3ODIzNzg3Nzl9.GHIs9-TO8patY8AKjgayuXrpciMx46JCXkIo4hekl5A)

 (image/gif)    


[modify_subpartition.GIF](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDFhMWFkOWEzMzExZGM4MThmIiwicmVmX2lkIjoiNjczOTZiNDE1OTNmOTljOWZmMjM2MDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyMzc5LCJleHAiOjE3ODIzNzg3Nzl9.mn6aEf_iqvvY5BH_Sw9az8PxqyqA563xPS4kNLcofvE)

 (image/gif)    


[add_subpartition.GIF](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDFhMWFkOWEzMzExZGM4MTkwIiwicmVmX2lkIjoiNjczOTZiNDE1OTNmOTljOWZmMjM2MDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyMzc5LCJleHAiOjE3ODIzNzg3Nzl9.D3m0TVxFXZotpdRRymEBAJamN9Nl3Siif93TbNAKErs)

 (image/gif)    
