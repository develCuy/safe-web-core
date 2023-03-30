import { useDropzone } from 'react-dropzone'
import { Typography, SvgIcon } from '@mui/material'
import type { Dispatch, SetStateAction } from 'react'

import FileUpload, { FileTypes } from '@/components/common/FileUpload'
import InfoIcon from '@/public/images/notifications/info.svg'

const AcceptedMimeTypes = {
  'application/json': ['.json'],
}

export const ImportFileUpload = ({
  setFileName,
  setJsonData,
}: {
  setFileName: Dispatch<SetStateAction<string | undefined>>
  setJsonData: Dispatch<SetStateAction<string | undefined>>
}) => {
  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) {
      return
    }
    const file = acceptedFiles[0]
    const reader = new FileReader()
    reader.onload = (event) => {
      if (!event.target) {
        return
      }
      if (typeof event.target.result !== 'string') {
        return
      }
      setFileName(file.name)
      setJsonData(event.target.result)
    }
    reader.readAsText(file)
  }

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    maxFiles: 1,
    onDrop,
    accept: AcceptedMimeTypes,
  })

  const onRemove = () => {
    setFileName(undefined)
    setJsonData(undefined)
  }

  return (
    <>
      <Typography>Import Safe data by clicking or dragging a file below.</Typography>

      <FileUpload
        fileType={FileTypes.JSON}
        getRootProps={() => ({ ...getRootProps(), height: '228px' })}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        isDragReject={isDragReject}
        onRemove={onRemove}
      />

      <Typography>
        <SvgIcon
          component={InfoIcon}
          inheritViewBox
          fontSize="small"
          color="border"
          sx={{
            verticalAlign: 'middle',
            mr: 0.5,
          }}
        />
        Only JSON files exported from a Safe can be imported.
      </Typography>
    </>
  )
}